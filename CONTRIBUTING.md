# Contributing

How work flows from a feature branch to production. Rationale in
[ADR-022](docs/adr/022-dev-main-branching-release-flow.md); this is the
operational guide.

## Branches

| Branch       | Role                                              | Deploys to              |
| ------------ | ------------------------------------------------- | ----------------------- |
| `production` | What is live in prod. Hotfix base.                | prod, manual only       |
| `main`       | The next release. Approved features collect here. | nothing directly        |
| `dev`        | Disposable staging, rebuilt automatically.        | Azure dev env (staging) |
| `dev-config` | Holds the staging manifest.                       | nothing                 |

The rule everyone remembers:

> **Features branch off `main`. Hotfixes branch off `production`. Prod always deploys from `production` or a `v*` tag, never from `main`.**

## Images are built once and promoted

`build.yml` builds an image tagged `sha-<commit>` when a commit lands on `dev`
or `main`, or when a `v*` tag is pushed. `deploy.yml` never builds: it tells
Azure to run an existing `sha-<commit>` image. So production runs the **exact
image** that was built and tested, never a rebuild. Keep that in mind below: a
release reuses an image that already exists.

---

## Everyday: shipping a feature

This is all most contributors ever need.

1. **Branch off `main`.**
   ```bash
   git checkout main && git pull
   git checkout -b your-feature
   ```
2. **Put it on staging via the manifest** (on the `dev-config` branch, one push):
   ```bash
   git fetch origin dev-config && git checkout dev-config
   echo "your-feature" >> .github/dev-branches.txt
   git commit -am "chore(dev): add your-feature to staging manifest"
   git push origin dev-config && git checkout your-feature
   ```
   The `Sync Dev` workflow rebuilds `dev` as `main` plus every manifest branch
   and deploys staging.
3. **Iterate on the feature branch, never on `dev`.** A rebuild wipes anything
   merged into `dev` by hand.
4. **When approved on staging, ship it:** rebase on `main`, PR into `main`, let
   CI pass, merge.
   ```bash
   git fetch origin && git rebase origin/main && git push --force-with-lease
   ```
5. **Clean up:** remove your branch from `.github/dev-branches.txt` on
   `dev-config` and delete the branch.

That is the whole everyday loop. You never touch `production`.

---

## Release manager: cutting a release

Promote the tested `main` line to prod. Prod runs the image already built on
`main`, so a release rebuilds nothing (the tag build is a cache hit).

```bash
git fetch origin
git tag v<X.Y.Z> origin/main && git push origin v<X.Y.Z>   # release marker + canonical image
git push origin origin/main:production                      # fast-forward the prod pointer
```

Then **Actions -> Deploy -> Run workflow**, `ref = v<X.Y.Z>`, `environment = prod`.
The run does not go straight to production. It writes the existing `sha-<commit>`
image to the **staging slot**, applies production's settings to that slot, warms
it and measures it — and then stops. Production is still serving the previous
image at that point, and stays on it until someone approves the swap.

If the `production` fast-forward is rejected, `production` carries a hotfix that
was not yet forward-ported to `main`; forward-port it first (see Hotfix), then
retry. Deploying from the `v*` tag (not a branch push) keeps this working once
`production` is protected.

## Release manager: the swap gate

Every prod deploy waits for a person between "the new image is ready on the
staging slot" and "production serves it". The `Swap Production Slots` job runs
in the `prod-swap` GitHub environment, which has **required reviewers**; the run
sits at `Review deployments` until one of them approves. **One approval is
enough** — they do not all have to answer. Who they are is not listed here on
purpose: the environment is the only source, under Settings → Environments →
`prod-swap`, and a copy in this file would go stale the first time someone joins
or leaves.

**What to look at while it waits.** The run summary above the gate carries
everything the decision needs: the staging hostname to open in a browser, the
build id production is expected to serve, the build id the slot actually
reports, and one row per rendered page with its warm response times and a
verdict. Open the hostname, sign in, click through the pages you care about.
The slot is already running with production's settings at that point, so what
you are looking at is what production will be.

**"Prevent self review" is off, and stays off.** The person who dispatches a
release has to be able to approve it: with a group this size, requiring a second
pair of eyes on paper would stop releases rather than improve them.

**Do not walk away from the gate. Reject it if you are not releasing.** An
approval has no deadline — an environment "wait timer" is a delay _before_ a job
starts, not a limit on how long it may wait for a human. An unanswered gate holds
the run for up to 30 days, and for all of that time the half-applied swap sits on
Azure with the slot carrying production's settings, and the next deploy refuses
to start. Rejecting is free: the cleanup job resets the pending swap and
production never moved. **Cancelling the run does the same** — a cancellation
reaches the cleanup job too — so that is the way out when nobody who can approve
is around.

**Admin bypass is on**, so an administrator can push the swap through without an
approval. That is the escape hatch for a gate that is genuinely stuck, and it is
worth being clear about the price: it promotes the release with nobody having
looked at the slot, which is the one thing the gate exists to prevent. Cancelling
costs nothing and leaves production untouched; bypassing costs the review. Prefer
cancelling.

**The environment puts no restriction on branches or tags.** That protection
lives in `deploy.yml`, which refuses a prod deploy from anything but `production`
or a `v*` tag. Do not add a second copy of it as an environment branch policy —
two rules that have to agree will not, and a mis-set one blocks legitimate
deploys with no useful error.

**The staging slot is stopped between releases.** It shares production's App
Service plan, and the two dry runs on 2026-09-10 showed that on a single-core
plan a slot starting or warming up is enough to make production time out. The
plan is P1v3 (two cores) for that reason, and the slot is still kept stopped when
it has no job: once production has verified, the swap job stops it; the cleanup
job stops it after a failed run; the next deploy starts it before writing the
image, and the rollback starts it before comparing builds. Do not start it by
hand to "have a look" — every minute it runs is a minute it shares the plan.

**During a release, production may still be slower.** The slot's container start
and the warm-up renders run on the same plan production serves from. Release in
a low-traffic window, and if you watch it, watch with one probe every 15 s at
most — three probes every 5 s against a busy plan were a large part of what took
production down on 2026-09-10. Read the plan's CPU metric afterwards rather than
trusting the probe alone.

**If the release turns out bad after the swap**, the slot still holds the image
production was serving. Dispatch **Actions -> Rollback Production**. It asks for
one value, `current_production_build`: the full commit sha production serves
right now, which the failed deploy's own summary prints for you to paste. That
is an interlock, not a choice — a rollback is a toggle, so pressing it twice
would put the bad release straight back, and naming the build you are leaving
makes the second press fail unless you meant it. The workflow then swaps once and
verifies production on the previous build.

Production comes back correct but **cold**: the slot was stopped, so the
rollback starts it and waits for it to report its build (about a minute) before
swapping, and the first renders after the swap are slow until the caches fill.
The rollback window also closes the moment the next deploy overwrites the slot;
after that, going back means deploying the older `v*` tag through the normal
path.

## Release manager: hotfix

An urgent fix that must reach prod without waiting for the next release, and
without dragging the unreleased `main` batch.

1. Branch off **`production`** (the live prod base), fix, gate locally:
   ```bash
   git checkout -b hotfix-<desc> production
   # ...fix...
   pnpm typecheck && pnpm test && pnpm lint
   ```
2. Open a PR into **`production`** (CI gates it), merge.
3. Build and deploy the fix:
   ```bash
   git tag v<X.Y.Z+1> production && git push origin v<X.Y.Z+1>   # build.yml builds this image
   ```
   **Actions -> Deploy -> Run workflow**, `ref = v<X.Y.Z+1>`, `environment = prod`.
   A hotfix waits at the swap gate like any release — plan for the approval
   rather than discovering it under pressure.
4. **Forward-port** so the fix is in the next release and on staging:
   ```bash
   git checkout main && git merge --no-ff hotfix-<desc> && git push origin main
   ```
   The push to `main` rebuilds `dev`, so staging gets the fix automatically.

`deploy.yml` refuses a prod deploy from `main` or any feature branch, so the
unreleased batch on `main` can never reach prod by a mis-selected ref.

---

## The manifest

`.github/dev-branches.txt` on `dev-config`, one branch per line, `#` comments
allowed. The live list of what is on staging. Add a branch to ride staging;
remove it (and delete the branch) the moment it merges to `main`.

## What not to do

- **Do not push directly to `main` or `production`.** Open a PR.
- **Do not deploy `main` to prod.** Prod deploys from `production` or a `v*` tag.
  The workflow enforces this.
- **Do not fix anything on `dev`.** It is rebuilt; your change vanishes.
- **Do not rely on the dev soup for correctness.** If feature B depends on A,
  stack B on A and ship A first, or hold B's PR.
- **Do not leave a merged branch in the manifest.** Remove it on merge.

## Commits and PRs

Conventional Commits, enforced repo-wide: `type(scope): description`. Allowed
types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `build`,
`ci`, `style`, `revert`. See [CLAUDE.md](CLAUDE.md) for the full rule.

## Before you push

```bash
pnpm typecheck && pnpm test && pnpm lint:fix
```

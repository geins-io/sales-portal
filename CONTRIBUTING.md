# Contributing

How work flows from a feature branch to production. Rationale in
[ADR-022](docs/adr/022-dev-main-branching-release-flow.md); this is the
operational guide.

## Branches

| Branch       | Role                                            | Deploys to              |
| ------------ | ----------------------------------------------- | ----------------------- |
| `production` | What is live in prod. Hotfix base.              | prod, manual only       |
| `main`       | The next release. Approved features collect here. | nothing directly      |
| `dev`        | Disposable staging, rebuilt automatically.      | Azure dev env (staging) |
| `dev-config` | Holds the staging manifest.                     | nothing                 |

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
It promotes the existing `sha-<commit>` image and swaps the prod slot.

If the `production` fast-forward is rejected, `production` carries a hotfix that
was not yet forward-ported to `main`; forward-port it first (see Hotfix), then
retry. Deploying from the `v*` tag (not a branch push) keeps this working once
`production` is protected.

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

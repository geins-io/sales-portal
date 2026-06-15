# Contributing

How work flows from a feature branch to production. Read this before pushing.
The rationale is in [ADR-022](docs/adr/022-dev-main-branching-release-flow.md);
this is the operational guide.

## Branches

| Branch       | Role                       | Deploys to            | Who writes to it                    |
| ------------ | -------------------------- | --------------------- | ----------------------------------- |
| `main`       | Production. Always equals prod between releases. | prod, manual only | PRs only (protected) |
| `dev`        | Disposable staging. Rebuilt automatically. | Azure dev env (staging) | automation; manual pushes are scratch |
| `dev-config` | Holds the staging manifest. | nothing               | direct push (it is just one file)   |
| `feature/*`  | Your work.                 | nothing directly      | you                                 |

The golden rule: **`main` equals production.** A branch reaches `main` only when
it is approved and about to ship. That is what lets a hotfix branch from `main`
without dragging anyone's in-flight work to prod.

## Feature flow

1. **Branch off `main`.**

   ```bash
   git checkout main && git pull
   git checkout -b your-feature-name
   ```

2. **Put it on staging via the manifest.** Add your branch name to
   `.github/dev-branches.txt` on the `dev-config` branch:

   ```bash
   git fetch origin dev-config
   git checkout dev-config
   echo "your-feature-name" >> .github/dev-branches.txt
   git commit -am "chore(dev): add your-feature-name to staging manifest"
   git push origin dev-config
   git checkout your-feature-name
   ```

   The `Sync Dev` workflow rebuilds `dev` as `main` plus every manifest branch
   and deploys staging. Your branch is now testable on the `.geins.dev` host.

3. **Iterate on the feature branch, never on `dev`.** Push fixes to your branch.
   To refresh staging with them, re-run the `Sync Dev` workflow (Actions tab ->
   Sync Dev -> Run workflow), or wait for the next push to `main`. Anything you
   merge into `dev` by hand is wiped on the next rebuild, so do not fix things
   there.

4. **When it is approved on staging, ship it.** Rebase on `main`, open a PR into
   `main`, let CI pass, merge.

   ```bash
   git fetch origin
   git rebase origin/main
   git push --force-with-lease
   # open the PR into main
   ```

5. **Clean up.** Remove your branch from `.github/dev-branches.txt` on
   `dev-config` and delete the branch. Merging to `main` rebuilds `dev`
   automatically, so your change is already on staging through the new `main`.

6. **Release.** Production is a manual `Deploy` run (`workflow_dispatch`,
   `environment=prod`), on the team's schedule. Never automated.

## Hotfix flow

1. Branch off `main` (it equals prod, so you get a clean base).
2. Fix, open a PR into `main`, merge.
3. Run the `Deploy` workflow for prod.

The push to `main` rebuilds `dev`, so the hotfix lands on staging
automatically. Do not cherry-pick it anywhere.

## The manifest

`.github/dev-branches.txt` on `dev-config`, one branch name per line, `#`
comments allowed. It is the live list of what is on staging.

- **Add** a line when a branch should ride staging.
- **Remove** the line the instant the branch merges to `main`, then delete the
  branch. A branch left in the manifest after it merges (especially a squash
  merge) makes the rebuild report a conflict.

## What not to do

- **Do not push directly to `main`.** Open a PR. `main` is production.
- **Do not run a prod deploy** unless you own the release. Prod is manual and
  scheduled by the team.
- **Do not fix anything on `dev`.** It is rebuilt and your change vanishes. Fix
  on the feature branch.
- **Do not rely on the dev soup for correctness.** If feature B depends on
  feature A, stack B on A and ship A first, or hold B's PR until A merges.
- **Do not leave a merged branch in the manifest.** Remove it on merge.

## Commits and PRs

Conventional Commits, enforced repo-wide. Every commit and PR title starts with
`type(scope): description`. Allowed types: `feat`, `fix`, `chore`, `docs`,
`test`, `refactor`, `perf`, `build`, `ci`, `style`, `revert`. See
[CLAUDE.md](CLAUDE.md) for the full rule, including what must never appear in a
commit message.

## Before you push

Run the gates locally so nothing red reaches GitHub:

```bash
pnpm typecheck
pnpm test
pnpm lint:fix
```

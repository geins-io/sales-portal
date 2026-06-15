---
title: Dev/main branching and release flow
status: accepted
created: 2026-06-15
author: '@geins'
tags: [ci, branching, release, deployment]
---

# ADR-022: Dev/main branching and release flow

## Context

The repository ran on a single `main` branch that served three roles at once:
the integration branch every feature merged into, the staging source (a push to
`main` auto-built and auto-deployed the Azure `dev` environment), and the
production source (prod is a manual `deploy.yml` run that ships whatever sits at
`main` HEAD).

Because `main` accumulated every in-flight, not-yet-approved change, a
production hotfix could not be released cleanly. Deploying `main` for a hotfix
would carry along unconfirmed development work that had not been tested or
approved. The requirement was a clean production branch so a hotfix never
depends on ongoing development, while still being able to test changes together
on staging.

The live Azure topology, read from the Bicep in `infra/`, is two environments,
not three: a `dev` environment (`rg-sales-portal-dev`, B1, no slot) that
functions as staging, and a `prod` environment (`rg-sales-portal-prod`, S1, plus
a `staging` deployment slot) that is deployed manually. The `staging`
environment defined in the templates is suspended and not deployed.

## Decision

Two long-lived branches, each with one job.

### `main` equals production

`main` is the production branch. It stays equal to what is in production between
releases: a feature is merged to `main` only when it is approved and about to
ship. Production deploys stay manual (`deploy.yml`, `workflow_dispatch`,
`environment=prod`) and are never automated. Because `main` carries only
shipped-or-shipping code, a hotfix branched from `main` is always clean and
carries no in-flight development work.

### `dev` is a disposable staging branch

`dev` auto-deploys to the Azure `dev` environment (staging). It is never
hand-curated as a source of truth. On every push to `main`, the `dev-sync.yml`
workflow rebuilds it as:

```
dev = main + every in-flight branch listed in the manifest
```

A push to `dev` made for a quick look is permitted but treated as scratch: the
next rebuild discards anything not in the manifest. This means a feature
approved on staging carries the soup of other in-flight branches, so the final
sign-off is the PR into `main`, where the change is rebased onto the real
production base.

### The manifest

`.github/dev-branches.txt` lists the in-flight feature branches that should ride
staging, one branch name per line, with `#` comments allowed. It lives on the
long-lived, unprotected `dev-config` branch so it can be edited with a plain
push, since `main` is protected. A branch is added when it should appear on
staging and removed the moment it merges to `main`, after which the branch is
deleted. The file doubles as the live record of what is on staging.

### Workflow wiring

- `build.yml` auto-deploys the `dev` branch to the Azure `dev` environment. A
  push to `main` builds the production image only and never auto-deploys. It
  also accepts `workflow_dispatch`. The dev deploy dispatch passes `--ref dev`
  so it deploys the dev commit's image rather than main's. The `latest` tag
  stays bound to `main`.
- `dev-sync.yml` (push to `main` and manual dispatch) resets `dev` to
  `origin/main`, re-merges each manifest branch, skips and reports any branch
  that conflicts or is already merged, force-pushes `dev` with the built-in
  `GITHUB_TOKEN`, then runs `gh workflow run build.yml --ref dev` to build and
  deploy staging. A push made with `GITHUB_TOKEN` does not re-trigger another
  workflow's `push` event, but `workflow_dispatch` is the documented exception
  that does run under `GITHUB_TOKEN`, so no personal access token or GitHub App
  is required. `concurrency` collapses a burst of merges into one rebuild.
- `ci.yml` keeps the full lint, type-check, unit, and e2e run on PRs into `main`
  (the production gate) and adds a lighter lint, type-check, and unit run on
  pushes to `dev`; e2e stays PR-only.

### Branch protection is a recommended follow-up

`main` should require a pull request and passing CI before merge, with force
pushes and deletions blocked. This makes a clean `main` enforced rather than
trusted. It requires repository admin rights and is tracked as a follow-up; the
model functions on convention without it.

## Consequences

**Positive:**

- A hotfix branches off `main`, which equals production, so it never drags
  in-flight development work to prod. This was the original requirement.
- Hotfixes and shipped features reach staging automatically: the push to `main`
  rebuilds `dev` from the new `main`, so no cherry-pick is needed to sync
  staging.
- `dev` cannot rot. It is recomputed from `main` plus the manifest on every main
  push rather than accumulating history.
- The manifest is a single, visible control surface for what is on staging.
- No personal credential lives in the automation; the built-in token plus
  `workflow_dispatch` chaining is sufficient.

**Trade-off:**

- What is validated on staging (`feature + dev soup`) is not exactly what ships
  (`feature + main`). This is mitigated by rebasing the feature onto `main`
  before the PR and by keeping `main` equal to production, so the difference is
  small. A blue-green gate on the existing prod `staging` slot would close the
  gap fully and is a possible later step.
- A branch that is squash-merged to `main` is no longer an ancestor of `main`,
  so it must be removed from the manifest promptly or the rebuild will try to
  re-merge it and report a conflict.
- Until branch protection is applied by an admin, a clean `main` depends on
  contributors following the flow rather than on enforcement.
- If two pushes to `main` land within seconds of each other, the staging
  build-then-deploy chain can briefly reference a `dev` image tag that the next
  rebuild has already moved past, producing one failed staging deploy. It
  self-heals on the next sync. Staging only, never production.

## Relationship to operational docs

The day-to-day contributor flow is documented in `CONTRIBUTING.md`, and the
quick reference lives in `CLAUDE.md`. The deployment topology is in
`infra/README.md`.

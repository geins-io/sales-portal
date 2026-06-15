---
title: Production/main/dev branching and release flow
status: accepted
created: 2026-06-15
author: '@geins'
tags: [ci, branching, release, deployment]
---

# ADR-022: Production/main/dev branching and release flow

## Context

The repository ran on a single `main` branch that served three roles at once:
the integration branch every feature merged into, the staging source (a push to
`main` auto-deployed the Azure dev environment), and the production source (prod
is a manual `deploy.yml` run that ships whatever sits at `main` HEAD).

Two problems followed. First, because `main` accumulated every in-flight,
not-yet-approved change, a production hotfix could not be released cleanly:
deploying `main` would carry along unconfirmed work. Second, the model only held
together if `main` never drifted ahead of production, which in practice it
always did. A release batch sits on `main`, in review, for days before it ships,
so for that whole window `main` is not equal to prod and a hotfix off `main`
would drag the batch.

The live Azure topology, read from the Bicep in `infra/`, is two environments:
a `dev` environment (`rg-sales-portal-dev`, B1, no slot) that functions as
staging, and a `prod` environment (`rg-sales-portal-prod`, S1, plus a `staging`
deployment slot) deployed manually.

A key property of the existing pipeline: container images are content-addressed
per commit (`build.yml` tags every build `sha-<commit>`), and `deploy.yml` never
builds. It tells Azure to run an existing `sha-<commit>` image. Production runs
the exact artifact that was built and tested. Any new model must preserve this
build-once-promote property.

## Decision

Three long-lived branches, each with one job, plus a deploy guard.

### `production` equals what is live in prod

`production` is the production branch. It moves only on a release or a hotfix,
and prod deploys promote its already-built image. It is the base hotfixes branch
from, so a hotfix always starts from the real prod state and never includes the
unreleased `main` batch. This is the property the single-branch model could not
provide once `main` drifted ahead of prod.

### `main` is the next release

Approved features collect on `main`. It is free to sit ahead of prod, because it
is the next release, not prod itself. Features branch off `main` and PR back into
it when approved on staging.

### `dev` is disposable staging

`dev` auto-deploys to the Azure dev environment and is rebuilt by `dev-sync.yml`
on every push to `main` as `main` plus the branches listed in the manifest
(`.github/dev-branches.txt` on the unprotected `dev-config` branch). It is never
hand-curated; a rebuild discards anything not in the manifest. A hotfix reaches
staging automatically because the forward-port to `main` triggers the rebuild.

### Build once, promote the image

`build.yml` builds per integrated commit: a push to `dev` builds the staging
image, a push to `main` builds the prod-candidate image, and a `v*` tag builds a
release or hotfix image. It does not build on `production`, because at release
`production` points at a `main` commit whose image already exists. A release
therefore promotes that existing image with no rebuild. A hotfix is the one new
prod-bound commit, and it gets a single build via its `v*` tag.

### Deploy guard

`deploy.yml` refuses a prod deploy unless the ref is the `production` branch or a
`v*` tag. A prod deploy from `main` or a feature branch is rejected. This makes
the unreleased `main` batch structurally unable to reach prod by a mis-selected
ref, rather than relying on the operator to pick correctly.

### Flows

- Feature: branch off `main`, add to the manifest to ride staging, rebase on
  `main`, PR into `main`.
- Release: move `production` to the tested `main` commit, deploy `production` to
  prod (reuses the built image), tag `v*` as the release marker.
- Hotfix: branch off `production`, PR into `production`, tag `v*` to build the
  fix image, deploy the tag to prod, then forward-port into `main`.

### CI and prod deploy automation

`ci.yml` runs the full lint, type, unit, and e2e gate on PRs into `main` and
`production`, and a light lint, type, and unit run on pushes to `dev`. Prod
deploy stays a deliberate manual run. It is not auto-triggered on a push to
`production`, because that would remove the human release gate. The supported
automated form, a push to `production` that auto-triggers the deploy but pauses
for a required reviewer on the `prod` environment, depends on a repository admin
configuring environment reviewers and is tracked as a follow-up.

## Consequences

**Positive:**

- A hotfix branches off `production`, which equals prod, so it never drags the
  unreleased `main` batch to production. `main` is free to stay ahead of prod.
- Production runs the exact image built and tested; a release rebuilds nothing.
- `dev` cannot rot; it is recomputed from `main` plus the manifest on every main
  push.
- The deploy guard makes a wrong-ref prod deploy fail closed rather than ship
  the batch.
- Everyday feature work is unchanged from a contributor's view: branch off
  `main`, ride staging via the manifest, PR into `main`.

**Trade-off:**

- A third long-lived branch and a small amount of release-time ceremony: moving
  `production`, tagging, and forward-porting a hotfix into `main`. This lands at
  release and hotfix moments, not in daily feature work.
- What is validated on staging (`main` plus the dev soup) is not byte-identical
  to what ships (a `main` commit), the standard integration-branch trade-off.
  Rebasing a feature on `main` before its PR keeps the gap small.
- Branch protection on `main` and `production`, and the approval-gated prod
  auto-deploy, require repository admin and are follow-ups; until then the model
  runs on convention plus the deploy guard.

## Relationship to operational docs

The contributor and release-manager flows are in `CONTRIBUTING.md`, the quick
reference is in `CLAUDE.md`, and the deployment topology is in `infra/README.md`.

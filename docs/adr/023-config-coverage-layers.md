---
title: Config coverage at unit level, config-derived assertions at e2e
status: accepted
created: 2026-09-07
author: '@geins'
tags: [tests, multi-tenant, tenant-config, types]
---

# ADR-023: Config coverage at unit level, config-derived assertions at e2e

## Context

Every field of `PublicTenantConfig` is a branch in the application. `mode`
selects catalog or commerce, `checkoutMode` selects hosted or custom, each entry
in `features` carries an `enabled` flag and an optional access rule, `theme` and
`branding` may or may not define a given token, `availableLocales` may hold one
entry or several. The product is the set of behaviours those fields select
between, not any one tenant's selection out of them.

Two questions follow, and a suite that mixes them answers neither. "Does the app
do the right thing for every value this field can take" is a question about the
matrix, and answering it requires control of the config. "Does the real stack
compose for a real tenant" is a question about one point in the matrix, and
answering it requires the live stack: a server that resolved a hostname, a
merchant API that answered, a browser that rendered.

Where the first question can be answered _provably_ is constrained by the type
gate. `pnpm typecheck` checks the four generated projects referenced from the
root `tsconfig.json`. `shared/` is inside that reach — `tsconfig.shared.json`
includes `shared/**/*`. `tests/` is outside it: `tests/tsconfig.json` is
referenced by nothing, so no file under `tests/` is type-checked by the gate. A
coverage map is a gate only where the compiler reads it.

## Decision

Two layers, one question each.

### Unit and component tests own the matrix

Unit and component tests answer "for every value of every public config field,
does the app do the right thing", with the config mocked so that every value is
reachable. This is the layer that exercises configurations no live tenant has.

### E2e owns composition for one real tenant

E2e answers "does the real stack compose for a real tenant". Its assertions are
derived from the live `/api/config` for the target rather than hardcoded: a spec
reads what the tenant is and asserts what that implies, so the same spec stays
honest against any tenant. That the target's config does not reach some path is
not a gap in this layer — covering that path is the other layer's job.

### Access is asserted on both branches

Where a config field controls access, both branches are asserted: anonymous and
signed-in. `orderPlacement.access: 'authenticated'` means an assertion that the
buy path is absent for an anonymous visitor _and_ an assertion that it completes
for a signed-in one. Asserting only the permissive branch lets a conditional
suite go vacuously green, and the deny side is the behaviour the setting exists
for.

### The totality map lives where the type gate reads it

Coverage of the matrix is declared as a map keyed by the public config surface —
one entry per field of `PublicTenantConfig`, checked with `satisfies` so that a
field added to the type without an entry fails `pnpm typecheck`. The map must
live inside the gate's reach; written under `tests/` it declares coverage
without enforcing any. Which mechanism carries it — the map in `shared/`, a
second typecheck project over the map alone, or bringing `tests/` into the gate
— is an implementation choice made on its own ticket. The requirement this ADR
sets is that the compiler reads it.

## Consequences

**Positive:**

- A new config field, or a new value of an existing one, fails the type gate
  until its coverage is declared, so the matrix cannot outgrow the tests
  silently.
- Specs stop encoding one tenant's configuration as application behaviour, which
  is what makes the e2e suite portable to any tenant.
- The deny side of an access rule is a real assertion instead of a skip.
- The layers fail for different reasons: a red unit test means a behaviour is
  wrong for some config, a red e2e means the stack does not compose for the
  configured tenant.
- A covered entry means the value is asserted at its consumer — a test of the
  getter or of a shared reader alone leaves the entry uncovered, with those
  tests recorded as what is known.

**Trade-off:**

- A green e2e run does not claim the matrix was covered. It ran the branch its
  tenant is in, and nothing else.
- A green unit run does not claim the stack composes. Mocked config never proves
  that a hostname resolves, a merchant API answers, or a theme reaches the
  browser.
- Totality is per field, not per feature name: `features` is typed
  `Record<string, ...>`, so the compiler cannot enumerate feature names from
  `PublicTenantConfig`. Per-feature coverage is enumerated from the seeded
  defaults object instead, which is a second source rather than a hand-written
  list, and the map is only as total as that object.
- The e2e target's config is deliberately not pinned as a baseline — e2e only
  ever runs the branch its tenant is in, so a snapshot would guard config
  identity rather than coverage, which lives in the unit layer.

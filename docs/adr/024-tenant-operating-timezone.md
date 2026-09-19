---
title: Tenant operating timezone
status: accepted
created: 2026-08-28
author: '@geins'
tags: [tenant, i18n, dates]
---

# ADR-024: Tenant operating timezone

## Context

Dates shown in the portal (order placed, invoice date, quote created) need a
timezone to render in. Three candidates were considered and rejected:

- **Server OS timezone.** Whatever the Nitro process happens to run in —
  arbitrary, and different between local dev, CI, and each deploy target.
- **Viewer's browser timezone.** Correct for a UI affordance like a delivery
  picker's `:min` date (see `app/pages/checkout.vue`), but wrong for a record
  like an order timestamp: a buyer in Singapore looking at a Stockholm
  merchant's order should see the merchant's operating time, not their own.
- **A raw UTC offset** (e.g. `GMT+1`). Does not shift for daylight saving —
  Stockholm is GMT+1 in winter and GMT+2 in summer, so a fixed offset is
  wrong for half the year.

## Decision

`TenantConfig.timezone` is an IANA timezone identifier (e.g.
`'Europe/Stockholm'`), never a raw offset. `Intl`'s `timeZone` option
resolves DST correctly per-date for any IANA identifier, which a fixed
offset cannot.

**Default is `'UTC'`, never a tenant-specific guess** (e.g. `Europe/Stockholm`
for "Swedish software"). This follows the same rule as
`DEFAULT_GEINS_SETTINGS` and the rest of tenant config: a generic fallback
that is visibly wrong and gets corrected, rather than a plausible-looking
guess that quietly stays wrong. `'UTC'` and `'Etc/UTC'` are functionally
identical (`Intl` resolves both to the same zone); `'UTC'` is used
everywhere for consistency and because it is the string already used
elsewhere in tenant config defaults.

Validated by `TimezoneSchema` (`server/schemas/store-settings.ts`), which
checks the value by attempting `Intl.DateTimeFormat` construction rather
than checking membership in `Intl.supportedValuesOf('timeZone')` — that
enumeration omits `'UTC'` itself even though the runtime accepts it as a
real `timeZone` value, so a membership check would reject the app's own
default. The error message models the correct shape
(`'Must be a valid IANA timezone identifier, e.g. "Europe/Stockholm"'`) so a
bad value is caught with an example at onboarding time, not discovered
later as a mis-rendered date.

Client-side formatting reads the tenant's timezone via `useTenant()` and
passes it through `app/utils/tenant-date.ts`'s `formatTenantDate()`, never
`toLocaleDateString()` without an explicit `timeZone`.

**Backward compatibility:** a `TenantConfig` already sitting in KV storage
from before this field existed comes back from a raw read without it — a
raw read isn't re-validated against the schema. `withTenantConfigDefaults()`
in `server/utils/tenant.ts` backfills `'UTC'` at every such read site,
per the standing rule that tenant-config migrations happen in
`server/utils/tenant.ts`, not at the schema boundary (see CLAUDE.md,
Multi-Tenancy).

## Consequences

- Dates render correctly across DST transitions everywhere in the portal,
  driven by one per-tenant setting instead of server or browser time.
- A tenant onboarded without specifying a timezone gets `UTC` — visibly
  generic, not a guess that happens to be right for one market and wrong
  for the rest.
- `checkout.vue`'s delivery-date picker deliberately keeps using the
  viewer's local timezone for its `:min` bound — that is a UI constraint on
  the viewer's "today," not a record, and stays out of scope for this ADR.
- A merchant that only operates in one market still has to set `timezone`
  explicitly to get anything other than UTC displayed — there is no
  market-to-timezone inference.

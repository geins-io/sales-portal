# CMS Slot Registry

The storefront refers to CMS content areas through logical slot keys
rather than raw `(family, areaName)` strings. Each tenant maps the keys
to their actual Geins Merchant Center collection via `tenant.cms.slots`.

## Why

Geins Merchant Center lets each merchant rename CMS collections freely
(e.g. one tenant names their logged-in-portal collection "Portal
(Customer logged in)", another calls it "Members Area"). Hardcoding
those strings in storefront code breaks any tenant that picks different
names.

The slot registry decouples the storefront from per-tenant CMS naming.
Storefront code asks for a logical slot (`PORTAL_HERO`); tenant config
supplies the concrete `{family, areaName}` to query.

## Design — tenant config is the single source of truth

There is NO global defaults map. Missing or partial slot configs resolve
to `null` and consumers fall back gracefully. Auto-provisioned dev
tenants ARE seeded with the Geins out-of-box names in
`server/utils/tenant.ts`, but that seed is per-tenant config, not a
global fallback.

Production tenants must configure their slots explicitly. The shape is
validated at the type level via `tenant.cms.slots`.

## Current slots

| Key                           | Where it renders                                     | Consumer                                | Typical `{family, areaName}`                                           |
| ----------------------------- | ---------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| `CMS_SLOTS.PORTAL_HERO`       | Banner at the top of every authenticated portal page | `app/components/portal/PortalShell.vue` | `{ family: "Portal (Customer logged in)", areaName: "Above Content" }` |
| `CMS_SLOTS.FRONTPAGE_CONTENT` | Main content area of the storefront landing page     | `app/pages/index.vue`                   | `{ family: "Frontpage", areaName: "Content" }`                         |

## How a tenant configures an override

Add to the tenant's stored config:

```json
{
  "cms": {
    "slots": {
      "portal_hero": {
        "family": "Members Area",
        "areaName": "Top Banner"
      }
    }
  }
}
```

Only slots a tenant wants to override need to appear. Slots not in the
map resolve to `null`; their consumers fall back (the portal hero shows
`PortalHeroFallback`, the frontpage shows the empty/error branch).

## How storefront code consumes a slot

```ts
import { CMS_SLOTS } from '#shared/types/cms-slots';

const slot = useCmsSlot(CMS_SLOTS.PORTAL_HERO);

const { data } = useFetch<ContentAreaType>('/api/cms/area', {
  query: computed(() =>
    slot.value
      ? {
          family: slot.value.family,
          areaName: slot.value.areaName,
          ...(currentLocale.value ? { locale: currentLocale.value } : {}),
          ...(currentMarket.value ? { market: currentMarket.value } : {}),
        }
      : { skip: '1' },
  ),
  immediate: !!slot.value,
  dedupe: 'defer',
});
```

The `immediate: !!slot.value` guard prevents a fetch when the slot is
not configured. The `skip: '1'` query keeps the reactive query object
stable (Nuxt complains when `query` returns `undefined` mid-flight).

## Null / fallback behaviour

When `useCmsSlot(key)` returns `null`:

- Consumers skip the `/api/cms/area` fetch entirely (no wasted request).
- Render a fallback component (e.g. `PortalHeroFallback`).
- No error is logged — missing slot config is a valid tenant
  configuration, not an error state.

When `useCmsSlot(key)` returns a config but the backend returns an empty
area (e.g. tenant created a collection shell but added no widgets):

- `server/services/cms.ts` `getContentArea` runs its language fallback
  (strip `languageId`, retry with the SDK's default locale) to handle
  single-locale content.
- If the fallback also returns empty, consumers render the fallback
  component — same code path as a missing slot.

## Adding a new slot

1. Add the key to `CMS_SLOTS` in `shared/types/cms-slots.ts`.
2. Add the slot to the seed map in `server/utils/tenant.ts` if dev
   tenants should get it automatically.
3. Document the slot in the table above.
4. Update existing production tenant configs to add the new slot (via
   whatever tenant-config sync process the tenant uses — Merchant
   Center sync, Redis seed, etc).

## Related files

- `shared/types/cms-slots.ts` — enum + `CmsSlotConfig` type.
- `shared/types/tenant-config.ts` — `tenant.cms.slots` schema.
- `app/composables/useCmsSlot.ts` — resolver.
- `server/utils/tenant.ts` — auto-provisioned tenant seed.
- `app/components/portal/PortalShell.vue` — `PORTAL_HERO` consumer.
- `app/pages/index.vue` — `FRONTPAGE_CONTENT` consumer.
- `docs/patterns/apply-for-account.md` — sibling pattern doc.

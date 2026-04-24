# CMS Config Registry — slots + menus

The storefront refers to CMS content areas and menus through logical
keys rather than raw Geins Merchant Center identifiers. Each tenant
maps the keys to their actual collection names via `tenant.cms`:

- `tenant.cms.slots[key]` — `{family, areaName}` for widget areas
  (consumed by `useCmsSlot` → `useFetch('/api/cms/area', ...)`).
- `tenant.cms.menus[key]` — `{menuLocationId}` for navigation menus
  (consumed by `useCmsMenu` / `useCmsMenuData`).

## Why

Geins Merchant Center lets each merchant rename CMS collections and
menu locations freely. Hardcoding those strings in storefront code
breaks any tenant that picks different names.

The registry decouples the storefront from per-tenant CMS naming.
Storefront code asks for a logical key (`PORTAL_HERO`, `HEADER_MAIN`);
tenant config supplies the concrete identifiers to query.

## Design — tenant config is the single source of truth

There is NO global defaults map. Missing or partial slot configs resolve
to `null` and consumers fall back gracefully. Auto-provisioned dev
tenants ARE seeded with the Geins out-of-box names in
`server/utils/tenant.ts`, but that seed is per-tenant config, not a
global fallback.

Production tenants must configure their slots explicitly. The shape is
validated at the type level via `tenant.cms.slots`.

## Current slots (`tenant.cms.slots`)

| Key                             | Where it renders                                     | Consumer                                  | Typical `{family, areaName}`                                           |
| ------------------------------- | ---------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| `CMS_SLOTS.PORTAL_HERO`         | Banner at the top of every authenticated portal page | `app/components/portal/PortalShell.vue`   | `{ family: "Portal (Customer logged in)", areaName: "Above Content" }` |
| `CMS_SLOTS.FRONTPAGE_CONTENT`   | Main content area of the storefront landing page     | `app/pages/index.vue`                     | `{ family: "Frontpage", areaName: "Content" }`                         |
| `CMS_SLOTS.PRODUCT_LIST_TOP`    | CMS area above the product grid on category PLPs     | `app/components/pages/ProductList.vue`    | `{ family: "Productlist", areaName: "Above List" }`                    |
| `CMS_SLOTS.PRODUCT_LIST_BOTTOM` | CMS area below the product grid on category PLPs     | `app/components/pages/ProductList.vue`    | `{ family: "Productlist", areaName: "Below List" }`                    |
| `CMS_SLOTS.PRODUCT_DETAIL`      | CMS area on product detail pages (PDP)               | `app/components/pages/ProductDetails.vue` | `{ family: "Product", areaName: "Below Details" }`                     |

## Current menus (`tenant.cms.menus`)

| Key                          | Where it renders                                                        | Consumer                                            | Typical `{menuLocationId}`         |
| ---------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------- |
| `CMS_MENUS.HEADER_MAIN`      | Desktop header nav bar                                                  | `app/components/layout/header/LayoutHeaderNav.vue`  | `{ menuLocationId: "main" }`       |
| `CMS_MENUS.FOOTER`           | Footer link columns                                                     | `app/components/layout/footer/LayoutFooterMain.vue` | `{ menuLocationId: "footer" }`     |
| `CMS_MENUS.MOBILE_DRAWER`    | Mobile off-canvas navigation                                            | `app/components/layout/MobileNavPanel.vue`          | `{ menuLocationId: "main" }`       |
| `CMS_MENUS.SIDEBAR_FALLBACK` | Default sidebar menu for CMS pages that don't declare a `pageArea.name` | `app/pages/[...slug].vue` → `PageSidebarNav`        | `{ menuLocationId: "info-pages" }` |

> Sidebar resolution: `pages/[...slug].vue` first tries
> `page.pageArea.name` (per-page, dynamic). If the page doesn't declare
> one, it falls back to `CMS_MENUS.SIDEBAR_FALLBACK` from tenant config.
> If neither is set, the sidebar simply doesn't render.

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
    },
    "menus": {
      "header_main": { "menuLocationId": "primary" },
      "footer": { "menuLocationId": "footer-links" }
    }
  }
}
```

Only entries a tenant wants to override need to appear. Entries not in
the map resolve to `null`; their consumers fall back gracefully:

- `FRONTPAGE_CONTENT` unconfigured → `pages/index.vue` renders
  `FrontpageFallback` (branded welcome hero).
- `PORTAL_HERO` unconfigured → `PortalShell.vue` renders
  `PortalHeroFallback`.
- `HEADER_MAIN` / `MOBILE_DRAWER` unconfigured → the nav bar / drawer
  simply omits the menu items; header still shows logo + search + cart.
- `FOOTER` unconfigured → footer link columns are hidden; copyright and
  branding remain.

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

## Adding a new slot or menu

1. Add the key to the appropriate enum:
   - Slots → `CMS_SLOTS` in `shared/types/cms-slots.ts`.
   - Menus → `CMS_MENUS` in `shared/constants/cms.ts`.
2. Add the entry to the seed map in `server/utils/tenant.ts` if dev /
   auto-provisioned tenants should get it automatically.
3. Add it to the dev-only fixture seed in
   `server/plugins/99.dev-tenant-seed.ts` (`FULL_CMS_CONFIG`) so local
   multi-tenant walkthrough stays complete.
4. Document the entry in the table above.
5. Update existing production tenant configs to add the new entry.

## Local multi-tenant walkthrough

A dev-only nitro plugin seeds three fixture tenants at startup so you
can verify CMS config behavior without a real merchant API:

- `tenant-a.localhost` — teal theme, full slots + menus
- `tenant-b.localhost` — rose theme, full slots + menus
- `tenant-blank.localhost` — no cms config (exercises all fallbacks)

```
curl -H "Host: tenant-a.localhost" http://localhost:3000/se/sv/
curl -H "Host: tenant-blank.localhost" http://localhost:3000/se/sv/
```

The plugin is a no-op in production (guarded on `import.meta.dev`).

## Related files

- `shared/types/cms-slots.ts` — slot enum + `CmsSlotConfig` type.
- `shared/constants/cms.ts` — menu enum + `CmsMenuConfig` type.
- `shared/types/tenant-config.ts` — `tenant.cms` schema.
- `app/composables/useCmsSlot.ts` — slot resolver.
- `app/composables/useCmsMenu.ts` — menu resolver (config only).
- `app/composables/useCmsMenuData.ts` — menu resolver + fetch wrapper.
- `server/utils/tenant.ts` — auto-provisioned tenant seed.
- `server/plugins/99.dev-tenant-seed.ts` — local fixture tenants.
- `app/components/portal/PortalShell.vue` — `PORTAL_HERO` consumer.
- `app/pages/index.vue` — `FRONTPAGE_CONTENT` consumer.
- `app/components/cms/FrontpageFallback.vue` — frontpage fallback.
- `app/components/layout/header/LayoutHeaderNav.vue` — `HEADER_MAIN` consumer.
- `app/components/layout/footer/LayoutFooterMain.vue` — `FOOTER` consumer.
- `app/components/layout/MobileNavPanel.vue` — `MOBILE_DRAWER` consumer.
- `docs/patterns/apply-for-account.md` — sibling pattern doc.

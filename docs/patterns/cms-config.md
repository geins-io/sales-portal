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

## Design — tenant config + safe defaults

Resolution order for `tenant.cms`:

1. **Explicit tenant config** (`appSettings.cms` in the merchant API
   response, or any KV-stored override) wins.
2. **`DEFAULT_CMS_CONFIG`** in `server/utils/tenant.ts` is applied when
   the tenant's StoreSettings has no `cms` block. The defaults match the
   Geins out-of-box admin family + areaName values, so a vanilla Geins
   install renders correctly without per-tenant work.
3. Per-key resolution still returns `null` when a tenant explicitly sets
   `cms` but omits the key — consumers still fall back gracefully.

Auto-provisioned dev tenants and the seeded fixtures use the same
`DEFAULT_CMS_CONFIG` constant, so all paths agree.

## Merchant API response shape

The Geins merchant API (`/store-settings?hostname=...`) returns:

```jsonc
{
  "geinsSettings": {
    /* api creds, defaultHostName, additionalHostNames */
  },
  "appSettings": {
    /* tenantId, hostname, theme, branding, features, cms, ... */
  },
}
```

`fetchTenantConfig` flattens the two halves before validating against
`StoreSettingsSchema`, and merges `geinsSettings.additionalHostNames` into
`appSettings.aliases` so all configured hostnames resolve to the right
tenant.

## Current slots (`tenant.cms.slots`)

| Key                             | Where it renders                                     | Consumer                                  | Typical `{family, areaName}`                                           |
| ------------------------------- | ---------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| `CMS_SLOTS.PORTAL_HERO`         | Banner at the top of every authenticated portal page | `app/components/portal/PortalShell.vue`   | `{ family: "Portal (Customer logged in)", areaName: "Above Content" }` |
| `CMS_SLOTS.FRONTPAGE_CONTENT`   | Main content area of the storefront landing page     | `app/pages/index.vue`                     | `{ family: "Frontpage", areaName: "Content" }`                         |
| `CMS_SLOTS.PRODUCT_LIST_TOP`    | CMS area above the product grid on category PLPs     | `app/components/pages/ProductList.vue`    | `{ family: "Productlist", areaName: "Above List" }`                    |
| `CMS_SLOTS.PRODUCT_LIST_BOTTOM` | CMS area below the product grid on category PLPs     | `app/components/pages/ProductList.vue`    | `{ family: "Productlist", areaName: "Below List" }`                    |
| `CMS_SLOTS.PRODUCT_DETAIL`      | CMS area on product detail pages (PDP)               | `app/components/pages/ProductDetails.vue` | `{ family: "Product", areaName: "Below Details" }`                     |

## Current menus (`tenant.cms.menus`)

| Key                          | Where it renders                                         | Consumer                                            | Typical `{menuLocationId}`         |
| ---------------------------- | -------------------------------------------------------- | --------------------------------------------------- | ---------------------------------- |
| `CMS_MENUS.HEADER_MAIN`      | Desktop header nav bar                                   | `app/components/layout/header/LayoutHeaderNav.vue`  | `{ menuLocationId: "main" }`       |
| `CMS_MENUS.FOOTER`           | Footer link columns                                      | `app/components/layout/footer/LayoutFooterMain.vue` | `{ menuLocationId: "footer" }`     |
| `CMS_MENUS.MOBILE_DRAWER`    | Mobile off-canvas navigation                             | `app/components/layout/MobileNavPanel.vue`          | `{ menuLocationId: "main" }`       |
| `CMS_MENUS.SIDEBAR_FALLBACK` | Sidebar nav for CMS pages tagged `CMS_TAGS.SIDEBAR_MENU` | `app/pages/[...slug].vue` → `PageSidebarNav`        | `{ menuLocationId: "info-pages" }` |

> Sidebar resolution: `pages/[...slug].vue` checks the page's tags via
> `hasPageTag(page, CMS_TAGS.SIDEBAR_MENU)`. When the tag is present, the
> tenant's `CMS_MENUS.SIDEBAR_FALLBACK` menu renders to the left of the
> page content. When absent (or the menu isn't configured), the sidebar
> doesn't render — same page just goes full-width.

## Current tags (`page.tags`)

| Key                     | Effect                                                            | Consumer                  | Stored as |
| ----------------------- | ----------------------------------------------------------------- | ------------------------- | --------- |
| `CMS_TAGS.SIDEBAR_MENU` | Render `CMS_MENUS.SIDEBAR_FALLBACK` as a sidebar nav on this page | `app/pages/[...slug].vue` | `#menu`   |

> Geins serializes admin tags hashtag-prefixed (`#menu`) and editors can
> type any casing. Always check tags through `hasPageTag()` from
> `shared/utils/cms-tags.ts` — it normalizes `#`, casing, and whitespace
> so the registry constants stay clean (`'menu'`, not `'#menu'`).

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
2. Add the entry to `DEFAULT_CMS_CONFIG` in `server/utils/tenant.ts` so
   every tenant (real + autocreated) gets it without per-tenant work.
3. Add it to the dev-only fixture seed in
   `server/plugins/99.dev-tenant-seed.ts` (`FULL_CMS_CONFIG`) so local
   multi-tenant walkthrough stays complete.
4. Document the entry in the table above.
5. Tenants that want a non-default mapping override via their stored
   `appSettings.cms` block — see "How a tenant configures an override".

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
- `server/utils/tenant.ts` — `DEFAULT_CMS_CONFIG`, response flattening, auto-provisioned tenant seed.
- `server/plugins/99.dev-tenant-seed.ts` — local fixture tenants.
- `app/components/portal/PortalShell.vue` — `PORTAL_HERO` consumer.
- `app/pages/index.vue` — `FRONTPAGE_CONTENT` consumer.
- `app/components/cms/FrontpageFallback.vue` — frontpage fallback.
- `app/components/layout/header/LayoutHeaderNav.vue` — `HEADER_MAIN` consumer.
- `app/components/layout/footer/LayoutFooterMain.vue` — `FOOTER` consumer.
- `app/components/layout/MobileNavPanel.vue` — `MOBILE_DRAWER` consumer.
- `docs/patterns/apply-for-account.md` — sibling pattern doc.

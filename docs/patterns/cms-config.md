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

Resolution order for `tenant.cms`. `buildTenantConfig` deep-merges
`DEFAULT_CMS_CONFIG` UNDER the tenant config, per key:

1. **`DEFAULT_CMS_CONFIG`** in `server/utils/tenant.ts` is the base layer.
   The defaults match the Geins out-of-box admin family + areaName values
   (and the standard menu locations), so a vanilla Geins install renders
   correctly without per-tenant work.
2. **Explicit tenant config** (`appSettings.cms` in the merchant API
   response, or any KV-stored override) wins per key over the defaults.
   The merge runs over both sub-objects (`slots`, `menus`) independently.
3. A tenant that configures some keys but omits others still inherits the
   defaults for the omitted keys. The previous `?? DEFAULT_CMS_CONFIG` was
   all-or-nothing: any tenant `cms` block dropped every default, so a newly
   added default slot or menu (for example `footer-2`/`footer-3`) never
   reached a configured tenant.

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

| Key                          | Where it renders                                                                                     | Consumer                                                                                        | Typical `{menuLocationId}`         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------- |
| `CMS_MENUS.HEADER_MAIN`      | Desktop header nav bar                                                                               | `app/components/layout/header/LayoutHeaderNav.vue`                                              | `{ menuLocationId: "main" }`       |
| `CMS_MENUS.FOOTER`           | First footer menu column (header = menu title); the footer also renders Contact + Address columns from store-settings | `app/components/layout/footer/LayoutFooterMain.vue`                                             | `{ menuLocationId: "footer-1" }`   |
| `CMS_MENUS.FOOTER_2`         | Second footer menu column (header = menu title)                                                      | `app/components/layout/footer/LayoutFooterMain.vue`                                             | `{ menuLocationId: "footer-2" }`   |
| `CMS_MENUS.FOOTER_3`         | Third footer menu column (header = menu title)                                                       | `app/components/layout/footer/LayoutFooterMain.vue`                                             | `{ menuLocationId: "footer-3" }`   |
| `CMS_MENUS.MOBILE_DRAWER`    | Mobile off-canvas navigation                                                                         | `app/components/layout/MobileNavPanel.vue`                                                      | `{ menuLocationId: "main" }`       |
| `CMS_MENUS.SIDEBAR_FALLBACK` | Sidebar nav for CMS pages tagged `CMS_TAGS.SIDEBAR_MENU` and for static info-page routes that opt in | `app/pages/[...slug].vue` + static info pages (e.g. `app/pages/contact.vue`) → `PageSidebarNav` | `{ menuLocationId: "info-pages" }` |

> Sidebar resolution on CMS pages: `pages/[...slug].vue` checks the page's
> tags via `hasPageTag(page, CMS_TAGS.SIDEBAR_MENU)`. When the tag is
> present, the tenant's `CMS_MENUS.SIDEBAR_FALLBACK` menu renders to the
> left of the page content. When absent (or the menu isn't configured),
> the sidebar doesn't render and the page goes full-width.
>
> Sidebar on static info pages: a hand-built page that wants the same
> info-page sidebar (e.g. `/contact`) calls `useCmsMenu(CMS_MENUS.SIDEBAR_FALLBACK)`
> directly and renders `<PageSidebarNav :menu-location-id="...">` when
> the tenant has configured the menu. No tag check; the page author
> opts in by including the sidebar markup. Static infopage routes should
> NOT keep their own hardcoded sidebar list; the menu is the single
> source of truth and gives the merchant admin control over the link set
> per tenant.

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
      "footer": { "menuLocationId": "footer-links" },
      "footer_2": { "menuLocationId": "footer-2" },
      "footer_3": { "menuLocationId": "footer-3" }
    }
  }
}
```

Only entries a tenant wants to override need to appear. Entries not in
the map resolve to `null`; their consumers fall back gracefully:

- `FRONTPAGE_CONTENT` unconfigured → `pages/index.vue` renders
  `FrontpageFallback` (branded welcome hero).
- `PORTAL_HERO` unconfigured → `PortalShell.vue` renders no hero at all
  (the area is omitted, no placeholder shell).
- `HEADER_MAIN` / `MOBILE_DRAWER` unconfigured → the nav bar / drawer
  simply omits the menu items; header still shows logo + search + cart.
- `FOOTER` / `FOOTER_2` / `FOOTER_3` map to up to three footer menu
  columns. Each column renders only when its menu location has visible
  items; the column header is that menu's own title (`menu.title`) and
  its links are a flat, single-level list. The footer's Contact and
  Address columns come from store-settings `contact` (and
  `contact.address`), not from a menu, so they render independently of
  the menu locations: Contact shows when an email or phone is set,
  Address shows when a street, postal code, city, or country is set. When
  no footer menus are configured and no contact or address is set, the
  footer middle block is hidden; copyright and branding remain.

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

A JSON page widget in the area can be form-shaped
(`{sendFormToEmail, fields}`); `JsonWidget.vue` routes that shape to
`FormWidget`, which renders the fields and submits via a `mailto:` link.
See [cms-form-widget.md](./cms-form-widget.md).

## Null / fallback behaviour

When `useCmsSlot(key)` returns `null`:

- Consumers skip the `/api/cms/area` fetch entirely (no wasted request).
- Render the area's fallback if it has one (e.g. `FrontpageFallback` for
  `FRONTPAGE_CONTENT`); areas without a fallback render nothing.
- No error is logged. Missing slot config is a valid tenant
  configuration, not an error state.

When `useCmsSlot(key)` returns a config but the backend returns an empty
area (e.g. tenant created a collection shell but added no widgets):

- `server/services/cms.ts` `getContentArea` runs its language fallback
  (strip `languageId`, retry with the SDK's default locale) to handle
  single-locale content.
- If the fallback also returns empty, consumers take the same path as a
  missing slot: render their fallback if they have one, otherwise nothing.

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

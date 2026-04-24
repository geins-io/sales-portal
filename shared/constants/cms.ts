/**
 * Legacy menu location IDs — the literal strings Geins Merchant Center
 * uses out of the box. Still exported for backward compatibility with
 * tests and any consumer that hasn't migrated to the CMS_MENUS registry
 * yet, and used as the default seed for auto-provisioned dev tenants.
 *
 * New code should NOT import these directly. Use `CMS_MENUS` + the
 * `useCmsMenuData` composable so tenants can rename their Merchant
 * Center menus without breaking the storefront.
 */
export const MENU_LOCATION = {
  MAIN: 'main',
  FOOTER: 'footer',
} as const;

export type MenuLocationId = (typeof MENU_LOCATION)[keyof typeof MENU_LOCATION];

/**
 * CMS menu registry — logical keys for the nav locations the storefront
 * renders. Tenants map each key to their actual Geins menuLocationId
 * via `tenant.cms.menus`. Missing keys resolve to `null` and consumers
 * fall back to a minimal hardcoded nav so the site never renders without
 * navigation.
 *
 * Mirrors the CMS_SLOTS pattern. See `shared/types/cms-slots.ts` for the
 * design rationale (tenant config is the single source of truth).
 *
 * Adding a new menu location:
 * 1. Add the key here.
 * 2. Seed it in `server/utils/tenant.ts` if dev tenants should get it.
 * 3. Document in `docs/patterns/cms-config.md`.
 * 4. Update production tenant configs.
 */
export const CMS_MENUS = {
  /** Primary nav shown in the header on every page. */
  HEADER_MAIN: 'header_main',
  /** Footer link list (columns or single list depending on layout). */
  FOOTER: 'footer',
  /** Off-canvas drawer shown on small screens. */
  MOBILE_DRAWER: 'mobile_drawer',
  /**
   * Default sidebar menu used by CMS pages tagged with "menu" that
   * don't declare their own `pageArea.name`. When a page DOES declare
   * a `pageArea.name`, that wins — this fallback only fires when the
   * page is silent. Keeps the dynamic sidebar consumer in
   * `pages/[...slug].vue` from hardcoding a tenant-specific menu name.
   */
  SIDEBAR_FALLBACK: 'sidebar_fallback',
} as const;

export type CmsMenuKey = (typeof CMS_MENUS)[keyof typeof CMS_MENUS];

/**
 * The shape stored under `tenant.cms.menus[key]`. `menuLocationId` is
 * the Merchant Center identifier for the menu (e.g. "main", "footer",
 * or a tenant-chosen name).
 */
export interface CmsMenuConfig {
  menuLocationId: string;
}

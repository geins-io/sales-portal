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
  /** Second footer menu location (additional footer column). */
  FOOTER_2: 'footer_2',
  /** Third footer menu location (additional footer column). */
  FOOTER_3: 'footer_3',
  /** Off-canvas drawer shown on small screens. */
  MOBILE_DRAWER: 'mobile_drawer',
  /**
   * Default sidebar menu used by CMS pages tagged with `CMS_TAGS.SIDEBAR_MENU`.
   * Tenants map this to the merchant-center menu (e.g. `info-pages`).
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

/**
 * CMS tag registry — logical keys for tags merchants can attach to a
 * Geins CMS page in the admin. The storefront keys behaviors off these
 * tags (e.g. show a sidebar nav when a page has `SIDEBAR_MENU`).
 *
 * The string value is what merchants type into the admin tag field.
 * Geins serializes tags hashtag-prefixed (`#menu`) — `hasPageTag()` in
 * `shared/utils/cms-tags.ts` normalizes the prefix and casing so this
 * registry stays free of `#` and lowercase by convention.
 *
 * Mirrors the `CMS_SLOTS` / `CMS_MENUS` pattern. New tags go here so the
 * convention stays grep-able and editors get a stable contract.
 */
export const CMS_TAGS = {
  /**
   * Page renders with the `SIDEBAR_FALLBACK` menu shown as a sidebar nav
   * to the left of the main content. Used for info pages (about, terms,
   * jobs, etc.) so editors can grow that section in the admin without
   * touching code.
   */
  SIDEBAR_MENU: 'menu',
  /**
   * Tags the CMS page that the topbar contact link resolves to. Editors
   * assign this tag in the Geins admin so the alias can be localized
   * (e.g. "kontakt" in SV, "contact" in EN) without touching any code.
   * Lowercase, no leading hash, matching the convention used across this
   * registry.
   */
  CONTACT_PAGE: 'contact',
  /**
   * Tags the CMS page that the topbar apply-for-account link resolves to.
   * Editors assign this tag in the Geins admin so the alias can be
   * localized per market without touching any code. Lowercase, no leading
   * hash, matching the convention used across this registry.
   */
  APPLY_PAGE: 'apply',
  /**
   * Tags the CMS page that the checkout terms-and-conditions link resolves to.
   * Editors assign this tag in the Geins admin so the alias can be localized
   * per market (e.g. "villkor" in SV) without touching any code. Lowercase, no
   * leading hash, matching the convention used across this registry.
   */
  TERMS_PAGE: 'terms',
} as const;

export type CmsTagKey = (typeof CMS_TAGS)[keyof typeof CMS_TAGS];

/**
 * Semantic slug map: the legacy English URL slugs that have historically
 * appeared as hardcoded links in topbar, login, and checkout flows, and that
 * 404 on tenants whose CMS pages use localized slugs (e.g. "villkor" instead
 * of "terms", "kontakt" instead of "contact").
 *
 * All routing guards and inbound-recovery logic must consume this map as the
 * single source of truth so the two slug aliases per tag (contact/contact-form,
 * apply/apply-for-account) stay in lockstep with the CMS_TAGS registry.
 *
 * Keys are lowercase, no leading slash. Two slugs alias the same tag where
 * both forms have appeared in the wild.
 */
export const CMS_SEMANTIC_SLUGS = Object.freeze({
  terms: CMS_TAGS.TERMS_PAGE,
  contact: CMS_TAGS.CONTACT_PAGE,
  'contact-form': CMS_TAGS.CONTACT_PAGE,
  apply: CMS_TAGS.APPLY_PAGE,
  'apply-for-account': CMS_TAGS.APPLY_PAGE,
} as const);

/** Union of every known semantic slug key. */
export type CmsSemanticSlug = keyof typeof CMS_SEMANTIC_SLUGS;

/**
 * The frozen set of semantic slug keys, for iterating in lint guards and
 * inbound-recovery without re-declaring the list elsewhere.
 */
export const CMS_SEMANTIC_SLUG_KEYS: readonly string[] = Object.freeze(
  Object.keys(CMS_SEMANTIC_SLUGS),
);

/**
 * Returns the CMS tag for a given slug, or null if the slug is not in the
 * semantic slug map. The input is normalized before lookup:
 *   - leading and trailing whitespace is trimmed
 *   - converted to lowercase
 *   - a single leading slash is stripped
 *   - a trailing slash is stripped
 *   - if the result still contains slashes (full path), the last non-empty
 *     segment is used, so '/se/sv/apply-for-account' resolves via its tail
 *
 * This function is pure: it has no side effects and imports no framework code,
 * making it safe to call from app/, server/, shared/, and tests/.
 */
export function cmsTagForSlug(slug: string): CmsTagKey | null {
  const trimmed = slug
    .trim()
    .toLowerCase()
    .replace(/^\//, '')
    .replace(/\/$/, '');
  if (!trimmed) return null;

  const segment = trimmed.includes('/')
    ? (trimmed.split('/').filter(Boolean).at(-1) ?? '')
    : trimmed;

  if (!segment) return null;

  if (segment in CMS_SEMANTIC_SLUGS) {
    return CMS_SEMANTIC_SLUGS[segment as CmsSemanticSlug];
  }

  return null;
}

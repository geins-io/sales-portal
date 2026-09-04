/**
 * CMS Slot Registry
 *
 * The storefront refers to CMS content areas through logical slot keys
 * rather than raw `(family, areaName)` strings. Each tenant maps the
 * keys to their actual Geins Merchant Center collection family + area
 * via `tenant.cms.slots`.
 *
 * Why this exists:
 * - Geins admin lets each merchant rename CMS collections freely.
 *   Hardcoding "Frontpage" / "Portal (Customer logged in)" in storefront
 *   code breaks any tenant that picks different names.
 * - The storefront stays decoupled from per-tenant CMS naming choices.
 *   New slots can be added without touching tenant configs that don't
 *   need them.
 *
 * Design decisions:
 * - Tenant config wins per key over `DEFAULT_CMS_CONFIG` in
 *   `server/utils/tenant.ts`, which supplies the Geins out-of-box names
 *   as the base layer. `useCmsSlot(key)` returns `null` for a slot that
 *   neither layer defines, and consumers handle that gracefully: some
 *   render a fallback (e.g. `FrontpageFallback`), while the portal hero
 *   renders nothing.
 * - Snake_case string values so they're readable in tenant JSON.
 *
 * Adding a new slot:
 * 1. Add the key here.
 * 2. Add the slot to `DEFAULT_CMS_CONFIG` in `server/utils/tenant.ts` so
 *    every tenant gets it without per-tenant work.
 * 3. Document the slot in `docs/patterns/cms-slots.md`.
 * 4. Update existing tenant configs in production to add the new slot.
 */
export const CMS_SLOTS = {
  /** Banner area at the top of every authenticated portal page. */
  PORTAL_HERO: 'portal_hero',
  /** Main content area on the unauthenticated storefront landing page. */
  FRONTPAGE_CONTENT: 'frontpage_content',
  /**
   * CMS area rendered above the product grid on category PLPs.
   * Not yet consumed by `pages/c/[...category].vue` — registered here
   * so tenants can pre-configure the mapping before the consumer ships.
   */
  PRODUCT_LIST_TOP: 'product_list_top',
  /**
   * CMS area rendered below the product grid on category PLPs.
   * Not yet consumed by `pages/c/[...category].vue` — registered here
   * so tenants can pre-configure the mapping before the consumer ships.
   */
  PRODUCT_LIST_BOTTOM: 'product_list_bottom',
  /**
   * CMS area rendered on product detail pages (PDP).
   * Not yet consumed by `ProductDetails.vue` — registered here so
   * tenants can pre-configure the mapping before the consumer ships.
   */
  PRODUCT_DETAIL: 'product_detail',
} as const;

export type CmsSlotKey = (typeof CMS_SLOTS)[keyof typeof CMS_SLOTS];

/**
 * The shape stored under `tenant.cms.slots[key]`.
 * Both fields must be present together — partial slot configs are
 * treated as "not configured" by the resolver.
 */
export interface CmsSlotConfig {
  family: string;
  areaName: string;
}

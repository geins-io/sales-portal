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
 * Design decisions (per Kristian, 2026-04-22):
 * - Tenant config is the SINGLE source of truth. There is no global
 *   defaults map — `useCmsSlot(key)` returns `null` when the slot is
 *   not configured, and consumers fall back gracefully (e.g. the
 *   PortalHeroFallback banner renders when the portal hero slot is
 *   missing or returns no content).
 * - Auto-provisioned dev tenants ARE seeded with the Geins out-of-box
 *   names in `server/utils/tenant.ts`. That seed is per-tenant config,
 *   not a global fallback. Production tenants must configure their
 *   slots explicitly.
 * - Snake_case string values so they're readable in tenant JSON.
 *
 * Adding a new slot:
 * 1. Add the key here.
 * 2. Add the slot to the `cms.slots` seed in `server/utils/tenant.ts`
 *    if dev tenants need it.
 * 3. Document the slot in `docs/patterns/cms-slots.md`.
 * 4. Update existing tenant configs in production to add the new slot.
 */
export const CMS_SLOTS = {
  /** Banner area at the top of every authenticated portal page. */
  PORTAL_HERO: 'portal_hero',
  /** Main content area on the unauthenticated storefront landing page. */
  FRONTPAGE_CONTENT: 'frontpage_content',
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

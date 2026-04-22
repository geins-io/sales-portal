import type { CmsSlotConfig, CmsSlotKey } from '#shared/types/cms-slots';

/**
 * Resolve a CMS slot key against the current tenant configuration.
 *
 * Returns `null` when the slot is not configured for this tenant or when
 * the tenant config has not loaded yet. Consumers must handle the null
 * case — typically by skipping the CMS fetch and rendering a fallback
 * (e.g. `PortalHeroFallback` for `PORTAL_HERO`).
 *
 * Tenant config is the SINGLE source of truth — there is no global
 * defaults map. Auto-provisioned dev tenants are seeded with the Geins
 * out-of-box names in `server/utils/tenant.ts`.
 *
 * Usage:
 *   const slot = useCmsSlot(CMS_SLOTS.PORTAL_HERO);
 *   const { data } = useFetch('/api/cms/area', {
 *     query: computed(() => slot.value
 *       ? { family: slot.value.family, areaName: slot.value.areaName, ... }
 *       : undefined,
 *     ),
 *     immediate: !!slot.value,
 *   });
 */
export function useCmsSlot(key: CmsSlotKey): ComputedRef<CmsSlotConfig | null> {
  const { tenant } = useTenant();
  return computed(() => {
    const slot = tenant.value?.cms?.slots?.[key];
    if (!slot) return null;
    if (!slot.family || !slot.areaName) return null;
    return slot;
  });
}

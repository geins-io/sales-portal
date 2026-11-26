import type { TenantConfig } from '../types/tenant-config';

type VariantSelectorSetting = NonNullable<
  NonNullable<TenantConfig['layout']>['variantSelector']
>;

export interface VariantSelectorMode {
  display: 'panel' | 'dropdown';
  grouping: 'dimension' | 'none';
}

/** Store setting PDP variant selection style; each absent key is today's panel. */
export function variantSelectorMode(
  settings: VariantSelectorSetting | null | undefined,
): VariantSelectorMode {
  return {
    display: settings?.display ?? 'panel',
    grouping: settings?.grouping ?? 'dimension',
  };
}

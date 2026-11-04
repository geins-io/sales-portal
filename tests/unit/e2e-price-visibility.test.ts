import { describe, it, expect, vi } from 'vitest';
import { computed } from 'vue';
import { canAccessFeature } from '../../shared/utils/feature-access';
import type { TenantConfig } from '../../shared/types/tenant-config';
import { signedOutSeesPrices } from '../e2e/price-visibility';

type Features = TenantConfig['features'];

/**
 * The anonymous price specs decide from `/api/config` whether a signed-out
 * visitor sees prices, and declare themselves out of scope when one does. That
 * decision is a copy of the app's rule, so it is checked against the app's
 * own `usePriceVisibility` here, fed the same features and a signed-out
 * buyer — the live team tenant only ever exercises one of these rows.
 */
let features: Features = {};

const tenant = () => ({
  isFeatureConfigured: (name: string) => name in features,
  hasFeature: (name: string) => features[name]?.enabled === true,
});
const signedOutAccess = () => ({
  canAccess: (name: string) =>
    canAccessFeature(features[name], { authenticated: false }),
});

vi.stubGlobal('computed', computed);
vi.stubGlobal('useTenant', tenant);
vi.stubGlobal('useFeatureAccess', signedOutAccess);
vi.mock('../../app/composables/useTenant', () => ({ useTenant: tenant }));
vi.mock('../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: signedOutAccess,
}));

const { usePriceVisibility } =
  await import('../../app/composables/usePriceVisibility');

const CASES: { label: string; features: Features; visible: boolean }[] = [
  {
    label: 'access all',
    features: { priceVisibility: { enabled: true, access: 'all' } },
    visible: true,
  },
  {
    label: 'access authenticated',
    features: { priceVisibility: { enabled: true, access: 'authenticated' } },
    visible: false,
  },
  {
    label: 'enabled with no access rule',
    features: { priceVisibility: { enabled: true } },
    visible: true,
  },
  {
    label: 'disabled, whatever the access',
    features: { priceVisibility: { enabled: false, access: 'all' } },
    visible: false,
  },
  { label: 'not configured', features: {}, visible: true },
];

describe('signedOutSeesPrices', () => {
  for (const c of CASES) {
    it(`${c.label}: ${c.visible ? 'prices shown' : 'prices hidden'}`, () => {
      expect(signedOutSeesPrices(c.features)).toBe(c.visible);
    });

    it(`${c.label}: agrees with the app's usePriceVisibility`, () => {
      features = c.features;
      expect(signedOutSeesPrices(c.features)).toBe(
        usePriceVisibility().showPrice.value,
      );
    });
  }

  it('a config without features shows prices, as the app does', () => {
    expect(signedOutSeesPrices(undefined)).toBe(true);
  });
});

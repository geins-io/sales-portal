// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computed, ref } from 'vue';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
let mockFeatures: Record<string, { enabled: boolean }> | undefined = undefined;
let mockHasFeature = (_name: string): boolean => false;
let mockCanAccess = (_name: string): boolean => false;

vi.stubGlobal('useTenant', () => ({
  features: computed(() => mockFeatures),
  hasFeature: (name: string) => mockHasFeature(name),
}));

vi.stubGlobal('useFeatureAccess', () => ({
  canAccess: (name: string) => mockCanAccess(name),
}));

vi.stubGlobal('computed', computed);
vi.stubGlobal('ref', ref);

vi.mock('../../app/composables/useTenant', () => ({
  useTenant: () => ({
    features: computed(() => mockFeatures),
    hasFeature: (name: string) => mockHasFeature(name),
  }),
}));

vi.mock('../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    canAccess: (name: string) => mockCanAccess(name),
  }),
}));

// ---------------------------------------------------------------------------
// Subject
// ---------------------------------------------------------------------------
const { usePriceVisibility } =
  await import('../../app/composables/usePriceVisibility');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('usePriceVisibility', () => {
  beforeEach(() => {
    mockFeatures = undefined;
    mockHasFeature = () => false;
    mockCanAccess = () => false;
  });

  it('returns showPrice=true when priceVisibility feature is not configured (fail-open)', () => {
    mockFeatures = undefined;
    const { showPrice } = usePriceVisibility();
    expect(showPrice.value).toBe(true);
  });

  it('returns showPrice=false when priceVisibility feature is present but enabled: false', () => {
    mockFeatures = { priceVisibility: { enabled: false } };
    mockHasFeature = () => false;
    const { showPrice } = usePriceVisibility();
    expect(showPrice.value).toBe(false);
  });

  it('returns showPrice=true when priceVisibility feature enabled and canAccess returns true', () => {
    mockFeatures = { priceVisibility: { enabled: true } };
    mockHasFeature = (name) => name === 'priceVisibility';
    mockCanAccess = (name) => name === 'priceVisibility';
    const { showPrice } = usePriceVisibility();
    expect(showPrice.value).toBe(true);
  });

  it('returns showPrice=false when priceVisibility feature enabled but canAccess returns false', () => {
    mockFeatures = { priceVisibility: { enabled: true } };
    mockHasFeature = (name) => name === 'priceVisibility';
    mockCanAccess = () => false;
    const { showPrice } = usePriceVisibility();
    expect(showPrice.value).toBe(false);
  });
});

// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computed } from 'vue';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
let mockIsFeatureConfigured = (_name: string): boolean => false;
let mockHasFeature = (_name: string): boolean => false;
let mockCanAccess = (_name: string): boolean => false;

vi.stubGlobal('useTenant', () => ({
  isFeatureConfigured: (name: string) => mockIsFeatureConfigured(name),
  hasFeature: (name: string) => mockHasFeature(name),
}));

vi.stubGlobal('useFeatureAccess', () => ({
  canAccess: (name: string) => mockCanAccess(name),
}));

vi.stubGlobal('computed', computed);

vi.mock('../../app/composables/useTenant', () => ({
  useTenant: () => ({
    isFeatureConfigured: (name: string) => mockIsFeatureConfigured(name),
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
    mockIsFeatureConfigured = () => false;
    mockHasFeature = () => false;
    mockCanAccess = () => false;
  });

  it('returns showPrice=true when priceVisibility feature is not configured (fail-open)', () => {
    mockIsFeatureConfigured = () => false;
    const { showPrice } = usePriceVisibility();
    expect(showPrice.value).toBe(true);
  });

  it('returns showPrice=false when priceVisibility feature is present but enabled: false', () => {
    mockIsFeatureConfigured = (name) => name === 'priceVisibility';
    mockHasFeature = () => false;
    const { showPrice } = usePriceVisibility();
    expect(showPrice.value).toBe(false);
  });

  it('returns showPrice=true when priceVisibility feature enabled and canAccess returns true', () => {
    mockIsFeatureConfigured = (name) => name === 'priceVisibility';
    mockHasFeature = (name) => name === 'priceVisibility';
    mockCanAccess = (name) => name === 'priceVisibility';
    const { showPrice } = usePriceVisibility();
    expect(showPrice.value).toBe(true);
  });

  it('returns showPrice=false when priceVisibility feature enabled but canAccess returns false', () => {
    mockIsFeatureConfigured = (name) => name === 'priceVisibility';
    mockHasFeature = (name) => name === 'priceVisibility';
    mockCanAccess = () => false;
    const { showPrice } = usePriceVisibility();
    expect(showPrice.value).toBe(false);
  });
});

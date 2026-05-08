// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computed } from 'vue';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
let mockHasFeature = (_name: string): boolean => false;
let mockCanAccess = (_name: string): boolean => false;

vi.stubGlobal('useTenant', () => ({
  hasFeature: (name: string) => mockHasFeature(name),
}));

vi.stubGlobal('useFeatureAccess', () => ({
  canAccess: (name: string) => mockCanAccess(name),
}));

vi.stubGlobal('computed', computed);

vi.mock('../../app/composables/useTenant', () => ({
  useTenant: () => ({
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
    mockHasFeature = () => false;
    mockCanAccess = () => false;
  });

  it('returns showPrice=true when feature "pricing" is not configured (fail-open)', () => {
    mockHasFeature = () => false;
    const { showPrice } = usePriceVisibility();
    expect(showPrice.value).toBe(true);
  });

  it('returns showPrice=false when pricing feature enabled but canAccess returns false', () => {
    mockHasFeature = (name) => name === 'priceVisibility';
    mockCanAccess = () => false;
    const { showPrice } = usePriceVisibility();
    expect(showPrice.value).toBe(false);
  });

  it('returns showPrice=true when pricing feature enabled and canAccess returns true', () => {
    mockHasFeature = (name) => name === 'priceVisibility';
    mockCanAccess = (name) => name === 'priceVisibility';
    const { showPrice } = usePriceVisibility();
    expect(showPrice.value).toBe(true);
  });
});

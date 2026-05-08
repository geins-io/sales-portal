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
const { useStockVisibility } =
  await import('../../app/composables/useStockVisibility');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useStockVisibility', () => {
  beforeEach(() => {
    mockFeatures = undefined;
    mockHasFeature = () => false;
    mockCanAccess = () => false;
  });

  it('returns showStock=true when stockStatus feature is not configured (fail-open)', () => {
    mockFeatures = undefined;
    const { showStock } = useStockVisibility();
    expect(showStock.value).toBe(true);
  });

  it('returns showStock=false when stockStatus feature is present but enabled: false', () => {
    mockFeatures = { stockStatus: { enabled: false } };
    mockHasFeature = () => false;
    const { showStock } = useStockVisibility();
    expect(showStock.value).toBe(false);
  });

  it('returns showStock=true when stockStatus feature enabled and canAccess returns true', () => {
    mockFeatures = { stockStatus: { enabled: true } };
    mockHasFeature = (name) => name === 'stockStatus';
    mockCanAccess = (name) => name === 'stockStatus';
    const { showStock } = useStockVisibility();
    expect(showStock.value).toBe(true);
  });

  it('returns showStock=false when stockStatus feature enabled but canAccess returns false', () => {
    mockFeatures = { stockStatus: { enabled: true } };
    mockHasFeature = (name) => name === 'stockStatus';
    mockCanAccess = () => false;
    const { showStock } = useStockVisibility();
    expect(showStock.value).toBe(false);
  });

  it('returns showStock=true for other features not named stockStatus (fail-open)', () => {
    mockFeatures = { price: { enabled: true } };
    mockCanAccess = () => false;
    const { showStock } = useStockVisibility();
    expect(showStock.value).toBe(true);
  });
});

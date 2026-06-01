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
const { useStockVisibility } =
  await import('../../app/composables/useStockVisibility');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useStockVisibility', () => {
  beforeEach(() => {
    mockIsFeatureConfigured = () => false;
    mockHasFeature = () => false;
    mockCanAccess = () => false;
  });

  it('returns showStock=true when stockStatus feature is not configured (fail-open)', () => {
    mockIsFeatureConfigured = () => false;
    const { showStock } = useStockVisibility();
    expect(showStock.value).toBe(true);
  });

  it('returns showStock=false when stockStatus feature is present but enabled: false', () => {
    mockIsFeatureConfigured = (name) => name === 'stockStatus';
    mockHasFeature = () => false;
    const { showStock } = useStockVisibility();
    expect(showStock.value).toBe(false);
  });

  it('returns showStock=true when stockStatus feature enabled and canAccess returns true', () => {
    mockIsFeatureConfigured = (name) => name === 'stockStatus';
    mockHasFeature = (name) => name === 'stockStatus';
    mockCanAccess = (name) => name === 'stockStatus';
    const { showStock } = useStockVisibility();
    expect(showStock.value).toBe(true);
  });

  it('returns showStock=false when stockStatus feature enabled but canAccess returns false', () => {
    mockIsFeatureConfigured = (name) => name === 'stockStatus';
    mockHasFeature = (name) => name === 'stockStatus';
    mockCanAccess = () => false;
    const { showStock } = useStockVisibility();
    expect(showStock.value).toBe(false);
  });

  it('returns showStock=true for other features not named stockStatus (fail-open)', () => {
    mockIsFeatureConfigured = (name) => name === 'price';
    mockCanAccess = () => false;
    const { showStock } = useStockVisibility();
    expect(showStock.value).toBe(true);
  });

  // Mirrors the live merchant API shape on a tenant that has explicitly
  // toggled stockStatus off (enabled:false, access:'authenticated'). The
  // enabled flag is the authority; access is only consulted when enabled.
  it('returns showStock=false when stockStatus is enabled:false with access set', () => {
    mockIsFeatureConfigured = (name) => name === 'stockStatus';
    mockHasFeature = () => false;
    mockCanAccess = (name) => name === 'stockStatus';
    const { showStock } = useStockVisibility();
    expect(showStock.value).toBe(false);
  });
});

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
const { useStockVisibility } =
  await import('../../app/composables/useStockVisibility');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useStockVisibility', () => {
  beforeEach(() => {
    mockHasFeature = () => false;
    mockCanAccess = () => false;
  });

  it('returns showStock=true when feature "stock" is not configured (fail-open)', () => {
    mockHasFeature = () => false;
    const { showStock } = useStockVisibility();
    expect(showStock.value).toBe(true);
  });

  it('returns showStock=true when stock feature enabled and canAccess returns true', () => {
    mockHasFeature = (name) => name === 'stockStatus';
    mockCanAccess = (name) => name === 'stockStatus';
    const { showStock } = useStockVisibility();
    expect(showStock.value).toBe(true);
  });

  it('returns showStock=false when stock feature enabled but canAccess returns false', () => {
    mockHasFeature = (name) => name === 'stockStatus';
    mockCanAccess = () => false;
    const { showStock } = useStockVisibility();
    expect(showStock.value).toBe(false);
  });

  it('returns showStock=true for other features not named stock (fail-open)', () => {
    // hasFeature('stockStatus') returns false, so stock is shown regardless
    mockHasFeature = (name) => name === 'price'; // stock not enabled
    mockCanAccess = () => false;
    const { showStock } = useStockVisibility();
    expect(showStock.value).toBe(true);
  });
});

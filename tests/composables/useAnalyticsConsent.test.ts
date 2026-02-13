import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

// Track useStorage calls
const useStorageSpy = vi.fn((_key: string, defaultValue: boolean) =>
  ref(defaultValue),
);

vi.mock('@vueuse/core', () => ({
  useStorage: (...args: [string, boolean]) => useStorageSpy(...args),
}));

// Mock useTenant — changeable per test via mockTenantId
const mockTenantId = ref('test-tenant');

const mockUseTenant = () => ({
  tenantId: mockTenantId,
});

vi.mock('#imports', () => ({
  useTenant: () => mockUseTenant(),
}));

vi.mock('../../app/composables/useTenant', () => ({
  useTenant: () => mockUseTenant(),
}));

describe('useAnalyticsConsent', () => {
  let useAnalyticsConsent: typeof import('../../app/composables/useAnalyticsConsent').useAnalyticsConsent;

  beforeEach(async () => {
    useStorageSpy.mockClear();
    useStorageSpy.mockImplementation((_key, defaultValue) => ref(defaultValue));
    mockTenantId.value = 'test-tenant';

    vi.resetModules();
    const mod = await import('../../app/composables/useAnalyticsConsent');
    useAnalyticsConsent = mod.useAnalyticsConsent;
  });

  it('defaults consent to false', () => {
    const { consent } = useAnalyticsConsent();
    expect(consent.value).toBe(false);
  });

  it('uses tenant-scoped localStorage key', () => {
    useAnalyticsConsent();
    expect(useStorageSpy).toHaveBeenCalledWith(
      'analytics-consent-test-tenant',
      false,
    );
  });

  it('accept() sets consent to true', () => {
    const { consent, accept } = useAnalyticsConsent();
    accept();
    expect(consent.value).toBe(true);
  });

  it('revoke() sets consent to false', () => {
    const { consent, accept, revoke } = useAnalyticsConsent();
    accept();
    expect(consent.value).toBe(true);
    revoke();
    expect(consent.value).toBe(false);
  });

  it('uses different keys for different tenants', () => {
    mockTenantId.value = 'other-tenant';
    useStorageSpy.mockClear();

    useAnalyticsConsent();

    expect(useStorageSpy).toHaveBeenCalledWith(
      'analytics-consent-other-tenant',
      false,
    );
  });
});

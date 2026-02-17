import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed as vueComputed } from 'vue';

// Track useStorage calls
const useStorageSpy = vi.fn(
  (_key: string, defaultValue: 'accepted' | 'declined' | null) =>
    ref(defaultValue),
);

vi.mock('@vueuse/core', () => ({
  useStorage: (...args: [string, 'accepted' | 'declined' | null]) =>
    useStorageSpy(...args),
}));

// Mock useTenant — changeable per test via mockTenantId
const mockTenantId = ref('test-tenant');

const mockUseTenant = () => ({
  tenantId: mockTenantId,
});

vi.mock('#imports', () => ({
  useTenant: () => mockUseTenant(),
  computed: (fn: () => unknown) => vueComputed(fn),
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

  it('defaults consent to false (no interaction yet)', () => {
    const { consent } = useAnalyticsConsent();
    expect(consent.value).toBe(false);
  });

  it('defaults hasInteracted to false', () => {
    const { hasInteracted } = useAnalyticsConsent();
    expect(hasInteracted.value).toBe(false);
  });

  it('uses tenant-scoped localStorage key with null default', () => {
    useAnalyticsConsent();
    expect(useStorageSpy).toHaveBeenCalledWith(
      'analytics-consent-test-tenant',
      null,
    );
  });

  it('accept() sets consent to true and hasInteracted to true', () => {
    const { consent, hasInteracted, accept } = useAnalyticsConsent();
    accept();
    expect(consent.value).toBe(true);
    expect(hasInteracted.value).toBe(true);
  });

  it('revoke() sets consent to false and hasInteracted to true', () => {
    const { consent, hasInteracted, revoke } = useAnalyticsConsent();
    revoke();
    expect(consent.value).toBe(false);
    expect(hasInteracted.value).toBe(true);
  });

  it('accept then revoke sets consent false but hasInteracted stays true', () => {
    const { consent, hasInteracted, accept, revoke } = useAnalyticsConsent();
    accept();
    expect(consent.value).toBe(true);
    revoke();
    expect(consent.value).toBe(false);
    expect(hasInteracted.value).toBe(true);
  });

  it('uses different keys for different tenants', () => {
    mockTenantId.value = 'other-tenant';
    useStorageSpy.mockClear();

    useAnalyticsConsent();

    expect(useStorageSpy).toHaveBeenCalledWith(
      'analytics-consent-other-tenant',
      null,
    );
  });
});

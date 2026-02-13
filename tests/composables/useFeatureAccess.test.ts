import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';

// Mock tenant data
const mockFeatures = ref<
  Record<string, { enabled: boolean; access?: unknown }> | undefined
>(undefined);

// Mock auth store — mutable per test
let mockAuthStore: {
  isAuthenticated: boolean;
  user: { customerType?: string } | null;
};

const mockUseTenant = () => ({
  features: computed(() => mockFeatures.value),
});

// Stub useAuthStore as global (Nuxt auto-import)
vi.stubGlobal('useAuthStore', () => mockAuthStore);
vi.stubGlobal('useTenant', () => mockUseTenant());

vi.mock('#imports', () => ({
  useTenant: () => mockUseTenant(),
  useAuthStore: () => mockAuthStore,
  computed,
}));

vi.mock('../../app/composables/useTenant', () => ({
  useTenant: () => mockUseTenant(),
}));

vi.mock('../../app/stores/auth', () => ({
  useAuthStore: () => mockAuthStore,
}));

describe('useFeatureAccess', () => {
  let useFeatureAccess: typeof import('../../app/composables/useFeatureAccess').useFeatureAccess;

  beforeEach(async () => {
    mockAuthStore = { isAuthenticated: false, user: null };
    mockFeatures.value = {
      search: { enabled: true },
      cart: { enabled: true, access: 'authenticated' },
      quotes: { enabled: true, access: { role: 'wholesale' } },
      disabled: { enabled: false },
    };

    vi.resetModules();
    const mod = await import('../../app/composables/useFeatureAccess');
    useFeatureAccess = mod.useFeatureAccess;
  });

  it('grants access to enabled feature with no access rule', () => {
    const { canAccess } = useFeatureAccess();
    expect(canAccess('search')).toBe(true);
  });

  it('denies access to disabled feature', () => {
    const { canAccess } = useFeatureAccess();
    expect(canAccess('disabled')).toBe(false);
  });

  it('denies access to nonexistent feature', () => {
    const { canAccess } = useFeatureAccess();
    expect(canAccess('nonexistent')).toBe(false);
  });

  it('denies access to authenticated feature when anonymous', () => {
    const { canAccess } = useFeatureAccess();
    expect(canAccess('cart')).toBe(false);
  });

  it('grants access to authenticated feature when logged in', () => {
    mockAuthStore.isAuthenticated = true;
    mockAuthStore.user = {};
    const { canAccess } = useFeatureAccess();
    expect(canAccess('cart')).toBe(true);
  });

  it('denies role-gated feature when customerType does not match', () => {
    mockAuthStore.isAuthenticated = true;
    mockAuthStore.user = { customerType: 'retail' };
    const { canAccess } = useFeatureAccess();
    expect(canAccess('quotes')).toBe(false);
  });

  it('grants role-gated feature when customerType matches', () => {
    mockAuthStore.isAuthenticated = true;
    mockAuthStore.user = { customerType: 'wholesale' };
    const { canAccess } = useFeatureAccess();
    expect(canAccess('quotes')).toBe(true);
  });

  it('handles undefined features gracefully', () => {
    mockFeatures.value = undefined;
    const { canAccess } = useFeatureAccess();
    expect(canAccess('search')).toBe(false);
  });
});

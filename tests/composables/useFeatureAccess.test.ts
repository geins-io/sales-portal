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

  it('handles undefined features gracefully', () => {
    mockFeatures.value = undefined;
    const { canAccess } = useFeatureAccess();
    expect(canAccess('search')).toBe(false);
  });

  describe('configuring', () => {
    it('lets a signed-in buyer configure when the configurator is on', () => {
      mockFeatures.value = { configurator: { enabled: true } };
      mockAuthStore.isAuthenticated = true;
      const { canConfigure, pageTypeOf } = useFeatureAccess();
      expect(canConfigure()).toBe(true);
      expect(pageTypeOf({ configurable: true })).toBe('configurable');
    });

    it('asks a guest to sign in, whatever a stored access rule says', () => {
      // An older stored config may still carry `access`; the point is that it is ignored.
      mockFeatures.value = { configurator: { enabled: true, access: 'all' } };
      const { canConfigure, pageTypeOf } = useFeatureAccess();
      expect(canConfigure()).toBe(false);
      expect(pageTypeOf({ configurable: true })).toBe('sign-in-to-configure');
    });

    it('treats a configurable product as ordinary when the configurator is off', () => {
      mockFeatures.value = { configurator: { enabled: false } };
      mockAuthStore.isAuthenticated = true;
      const { canConfigure, pageTypeOf } = useFeatureAccess();
      expect(canConfigure()).toBe(false);
      expect(pageTypeOf({ configurable: true })).toBe('ordinary');
    });

    it('refuses configuring before the tenant config has loaded', () => {
      mockFeatures.value = undefined;
      mockAuthStore.isAuthenticated = true;
      const { canConfigure, pageTypeOf } = useFeatureAccess();
      expect(canConfigure()).toBe(false);
      expect(pageTypeOf({ configurable: true })).toBe('ordinary');
    });

    it('follows the buyer signing in without a new composable', () => {
      mockFeatures.value = { configurator: { enabled: true } };
      const { canConfigure, pageTypeOf } = useFeatureAccess();
      expect(pageTypeOf({ configurable: true })).toBe('sign-in-to-configure');
      mockAuthStore.isAuthenticated = true;
      expect(canConfigure()).toBe(true);
      expect(pageTypeOf({ configurable: true })).toBe('configurable');
    });
  });
});

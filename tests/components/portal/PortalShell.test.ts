import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { mountComponent } from '../../utils/component';
import PortalShell from '../../../app/components/portal/PortalShell.vue';
import { createPinia, setActivePinia } from 'pinia';
import { useTenant } from '../../../app/composables/useTenant';
import { useFavoritesStore } from '../../../app/stores/favorites';

// Mock useFetch for profile data
const mockUseFetch = vi.fn(() => ({
  data: ref({
    profile: {
      id: 1,
      email: 'adam@example.com',
      address: {
        firstName: 'Adam',
        lastName: 'Johnsson',
        company: 'Company AB',
      },
    },
  }),
  pending: ref(false),
  error: ref(null),
  status: ref('success'),
  refresh: vi.fn(),
  execute: vi.fn(),
}));

// Mock at the module level — Nuxt auto-imports resolve to these internal modules
vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args),
}));

// Also stub globally for direct access
vi.stubGlobal('useFetch', (...args: unknown[]) => mockUseFetch(...args));

// Stub navigateTo (Nuxt auto-import, not available in component tier)
vi.stubGlobal('navigateTo', vi.fn());

// Mock useFeatureAccess — default: all features denied (organisation tab hidden)
const mockCanAccess = vi.fn(() => false);
vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canAccess: mockCanAccess }),
}));

const iconStub = {
  template: '<span class="icon" :data-name="name"></span>',
  props: ['name'],
};

const stubs = { Icon: iconStub, NuxtIcon: iconStub };

function enableWishlistFeature() {
  const { tenant } = useTenant();
  tenant.value = {
    ...tenant.value,
    features: {
      ...tenant.value?.features,
      wishlist: { enabled: true },
    },
  };
}

function disableWishlistFeature() {
  const { tenant } = useTenant();
  tenant.value = {
    ...tenant.value,
    features: {
      ...tenant.value?.features,
      wishlist: { enabled: false },
    },
  };
}

describe('PortalShell', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockCanAccess.mockReturnValue(false);
    // Reset tenant features to default (no wishlist)
    disableWishlistFeature();
  });

  it('hides hero banner when CMS area is empty', () => {
    const wrapper = mountComponent(PortalShell, {
      slots: { default: '<div>content</div>' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="portal-hero"]').exists()).toBe(false);
  });

  it('renders welcome card with user name', () => {
    const wrapper = mountComponent(PortalShell, {
      slots: { default: '<div>content</div>' },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('portal.welcome');
  });

  it('renders 5 tabs when organisation feature flag is off', () => {
    mockCanAccess.mockReturnValue(false);
    const wrapper = mountComponent(PortalShell, {
      slots: { default: '<div>content</div>' },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('portal.tabs.overview');
    expect(wrapper.text()).toContain('portal.tabs.orders');
    expect(wrapper.text()).toContain('portal.tabs.quotations');
    expect(wrapper.text()).toContain('portal.tabs.products');
    expect(wrapper.text()).toContain('portal.tabs.lists');
    expect(wrapper.text()).not.toContain('portal.tabs.organisation');
  });

  it('renders organisation tab when feature flag is enabled', () => {
    mockCanAccess.mockReturnValue(true);
    const wrapper = mountComponent(PortalShell, {
      slots: { default: '<div>content</div>' },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('portal.tabs.organisation');
  });

  it('renders slot content', () => {
    const wrapper = mountComponent(PortalShell, {
      slots: { default: '<div data-testid="slot-content">hello</div>' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="slot-content"]').exists()).toBe(true);
  });

  it('renders quick links (favorites, account, logout)', () => {
    enableWishlistFeature();
    const wrapper = mountComponent(PortalShell, {
      slots: { default: '<div>content</div>' },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('portal.quick_links.favorites');
    expect(wrapper.text()).toContain('portal.quick_links.account');
    expect(wrapper.text()).toContain('portal.quick_links.logout');
  });

  describe('favorites quick link', () => {
    it('links to /portal/favorites when wishlist feature is enabled', () => {
      enableWishlistFeature();
      const wrapper = mountComponent(PortalShell, {
        slots: { default: '<div>content</div>' },
        global: { stubs },
      });
      const favoritesLink = wrapper
        .findAll('a')
        .find((a) => a.text().includes('portal.quick_links.favorites'));
      expect(favoritesLink).toBeDefined();
      expect(favoritesLink!.attributes('href')).toBe('/se/en/portal/favorites');
    });

    it('hides favorites quick link when wishlist feature is disabled', () => {
      disableWishlistFeature();
      const wrapper = mountComponent(PortalShell, {
        slots: { default: '<div>content</div>' },
        global: { stubs },
      });
      const favoritesLink = wrapper
        .findAll('a')
        .find((a) => a.text().includes('portal.quick_links.favorites'));
      expect(favoritesLink).toBeUndefined();
    });

    it('shows count badge when favorites exist', () => {
      enableWishlistFeature();
      const pinia = createPinia();
      setActivePinia(pinia);
      const store = useFavoritesStore();
      store.$patch({ items: ['prod-1', 'prod-2', 'prod-3'] });

      const wrapper = mountComponent(PortalShell, {
        slots: { default: '<div>content</div>' },
        global: { stubs, plugins: [pinia] },
      });
      const badge = wrapper.find('[data-testid="favorites-count"]');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toBe('3');
    });

    it('hides count badge when no favorites', () => {
      enableWishlistFeature();
      const pinia = createPinia();
      setActivePinia(pinia);
      const store = useFavoritesStore();
      store.$patch({ items: [] });

      const wrapper = mountComponent(PortalShell, {
        slots: { default: '<div>content</div>' },
        global: { stubs, plugins: [pinia] },
      });
      const badge = wrapper.find('[data-testid="favorites-count"]');
      expect(badge.exists()).toBe(false);
    });
  });

  describe('favorites tab', () => {
    it('shows favorites tab when wishlist feature is accessible', () => {
      mockCanAccess.mockImplementation(
        (feature: string) => feature === 'wishlist',
      );
      const wrapper = mountComponent(PortalShell, {
        slots: { default: '<div>content</div>' },
        global: { stubs },
      });
      expect(wrapper.text()).toContain('portal.tabs.favorites');
    });

    it('hides favorites tab when wishlist feature is not accessible', () => {
      mockCanAccess.mockReturnValue(false);
      const wrapper = mountComponent(PortalShell, {
        slots: { default: '<div>content</div>' },
        global: { stubs },
      });
      expect(wrapper.text()).not.toContain('portal.tabs.favorites');
    });

    it('favorites tab links to /portal/favorites', () => {
      mockCanAccess.mockReturnValue(true);
      const wrapper = mountComponent(PortalShell, {
        slots: { default: '<div>content</div>' },
        global: { stubs },
      });
      const tabLinks = wrapper.findAll('[data-testid="portal-tabs"] a');
      const favoritesTab = tabLinks.find((a) =>
        a.text().includes('portal.tabs.favorites'),
      );
      expect(favoritesTab).toBeDefined();
      expect(favoritesTab!.attributes('href')).toBe('/se/en/portal/favorites');
    });
  });
});

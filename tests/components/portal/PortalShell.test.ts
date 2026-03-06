import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { mountComponent } from '../../utils/component';
import PortalShell from '../../../app/components/portal/PortalShell.vue';
import { createPinia, setActivePinia } from 'pinia';

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

describe('PortalShell', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders hero banner', () => {
    const wrapper = mountComponent(PortalShell, {
      slots: { default: '<div>content</div>' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="portal-hero"]').exists()).toBe(true);
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
    const wrapper = mountComponent(PortalShell, {
      slots: { default: '<div>content</div>' },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('portal.quick_links.favorites');
    expect(wrapper.text()).toContain('portal.quick_links.account');
    expect(wrapper.text()).toContain('portal.quick_links.logout');
  });
});

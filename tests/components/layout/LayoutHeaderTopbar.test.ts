import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import LayoutHeaderTopbar from '../../../app/components/layout/header/LayoutHeaderTopbar.vue';

const authStoreState = {
  isAuthenticated: false,
  displayName: '',
  openSheet: vi.fn(),
};

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => authStoreState,
}));

const enabledFeatures = new Set<string>([
  'search',
  'authentication',
  'cart',
  'applyForAccount',
]);

vi.mock('../../../app/composables/useTenant', () => ({
  useTenant: () => ({
    hasFeature: (name: string) => enabledFeatures.has(name),
  }),
}));

describe('LayoutHeaderTopbar', () => {
  beforeEach(() => {
    authStoreState.isAuthenticated = false;
    authStoreState.displayName = '';
  });

  it('paints bg-top-bar-background on the topbar surface', () => {
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    const topbar = wrapper.find('[data-slot="topbar"]');
    expect(topbar.exists()).toBe(true);
    expect(topbar.classes()).toContain('bg-top-bar-background');
    expect(topbar.classes()).not.toContain('bg-primary');
  });

  it('renders contact link', () => {
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    expect(wrapper.text()).toContain('layout.contact_us');
  });

  it('renders login link when not authenticated', () => {
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    expect(wrapper.text()).toContain('auth.login');
  });

  it('renders locale switcher stub', () => {
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    expect(wrapper.find('locale-switcher-stub').exists()).toBe(true);
  });

  it('shows the apply-for-account link when not authenticated and feature enabled', () => {
    authStoreState.isAuthenticated = false;
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    expect(wrapper.text()).toContain('layout.apply_for_account');
  });

  it('hides the apply-for-account link when authenticated', () => {
    authStoreState.isAuthenticated = true;
    authStoreState.displayName = 'Ada';
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    expect(wrapper.text()).not.toContain('layout.apply_for_account');
    expect(wrapper.text()).toContain('Ada');
  });
});

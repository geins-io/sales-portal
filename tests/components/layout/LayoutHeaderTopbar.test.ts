import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
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

// Controllable refs driven per-test via the helper below
const contactToRef = ref('/se/sv/kontakt');
const applyToRef = ref('/se/sv/apply-for-account');

vi.mock('../../../app/composables/useCmsPageLink', () => ({
  useCmsPageLink: (tag: string) => {
    if (tag === 'contact') return { to: contactToRef };
    if (tag === 'apply') return { to: applyToRef };
    return { to: ref('/') };
  },
}));

describe('LayoutHeaderTopbar', () => {
  beforeEach(() => {
    authStoreState.isAuthenticated = false;
    authStoreState.displayName = '';
    contactToRef.value = '/se/sv/kontakt';
    applyToRef.value = '/se/sv/apply-for-account';
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

  it('(a) contact anchor href equals the CMS-resolved value from useCmsPageLink', () => {
    contactToRef.value = '/se/sv/kontakt';
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    // NuxtLink stub renders as <a :href="to">; find the contact anchor by aria-label
    const contactAnchor = wrapper.find('a[aria-label="layout.contact_us"]');
    expect(contactAnchor.exists()).toBe(true);
    expect(contactAnchor.attributes('href')).toBe('/se/sv/kontakt');
  });

  it('(b) contact anchor href equals fallback value when useCmsPageLink yields fallback', () => {
    contactToRef.value = '/se/sv/contact-form';
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    const contactAnchor = wrapper.find('a[aria-label="layout.contact_us"]');
    expect(contactAnchor.exists()).toBe(true);
    expect(contactAnchor.attributes('href')).toBe('/se/sv/contact-form');
  });

  it('(c) apply anchor href equals CMS-resolved value when applyForAccount enabled and not authenticated', () => {
    authStoreState.isAuthenticated = false;
    applyToRef.value = '/se/sv/apply-for-account';
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    const applyAnchor = wrapper.find('a[href="/se/sv/apply-for-account"]');
    expect(applyAnchor.exists()).toBe(true);
  });

  it('(c2) apply anchor is absent when authenticated, regardless of useCmsPageLink value', () => {
    authStoreState.isAuthenticated = true;
    authStoreState.displayName = 'Ada';
    applyToRef.value = '/se/sv/apply-for-account';
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    // The apply link is gated by !authStore.isAuthenticated
    const applyText = wrapper.text();
    expect(applyText).not.toContain('layout.apply_for_account');
  });
});

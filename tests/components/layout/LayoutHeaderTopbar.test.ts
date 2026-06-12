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
const contactToRef = ref<string | null>('/se/sv/kontakt');
const contactResolvedRef = ref(true);
const applyToRef = ref<string | null>('/se/sv/ansok-om-konto');
const applyResolvedRef = ref(true);

vi.mock('../../../app/composables/useCmsPageLink', () => ({
  useCmsPageLink: (tag: string) => {
    if (tag === 'contact')
      return { to: contactToRef, isResolved: contactResolvedRef };
    if (tag === 'apply')
      return { to: applyToRef, isResolved: applyResolvedRef };
    return { to: ref('/'), isResolved: ref(true) };
  },
}));

describe('LayoutHeaderTopbar', () => {
  beforeEach(() => {
    authStoreState.isAuthenticated = false;
    authStoreState.displayName = '';
    contactToRef.value = '/se/sv/kontakt';
    contactResolvedRef.value = true;
    applyToRef.value = '/se/sv/ansok-om-konto';
    applyResolvedRef.value = true;
  });

  it('renders login link when not authenticated', () => {
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    expect(wrapper.text()).toContain('auth.login');
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
    contactResolvedRef.value = true;
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    // NuxtLink stub renders as <a :href="to">; find the contact anchor by aria-label
    const contactAnchor = wrapper.find('a[aria-label="layout.contact_us"]');
    expect(contactAnchor.exists()).toBe(true);
    expect(contactAnchor.attributes('href')).toBe('/se/sv/kontakt');
  });

  it('(b) contact anchor is absent when useCmsPageLink yields isResolved false', () => {
    contactToRef.value = null;
    contactResolvedRef.value = false;
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    const contactAnchor = wrapper.find('a[aria-label="layout.contact_us"]');
    expect(contactAnchor.exists()).toBe(false);
  });

  it('(c) apply anchor href equals CMS-resolved value when applyForAccount enabled and not authenticated', () => {
    authStoreState.isAuthenticated = false;
    applyToRef.value = '/se/sv/ansok-om-konto';
    applyResolvedRef.value = true;
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    const applyAnchor = wrapper.find('a[href="/se/sv/ansok-om-konto"]');
    expect(applyAnchor.exists()).toBe(true);
  });

  it('apply anchor is absent when isResolved false, even with feature enabled and not authenticated', () => {
    authStoreState.isAuthenticated = false;
    applyToRef.value = null;
    applyResolvedRef.value = false;
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    // Assert on the anchor element, not just text: the apply NuxtLink must be
    // removed by v-if, not rendered as a hrefless anchor.
    const applyAnchor = wrapper
      .findAll('a')
      .find((a) => a.text().includes('layout.apply_for_account'));
    expect(applyAnchor).toBeUndefined();
  });

  it('(c2) apply anchor is absent when authenticated, regardless of useCmsPageLink value', () => {
    authStoreState.isAuthenticated = true;
    authStoreState.displayName = 'Ada';
    applyToRef.value = '/se/sv/ansok-om-konto';
    applyResolvedRef.value = true;
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    // The apply link is gated by !authStore.isAuthenticated
    const applyText = wrapper.text();
    expect(applyText).not.toContain('layout.apply_for_account');
  });
});

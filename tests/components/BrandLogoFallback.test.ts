import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computed, ref } from 'vue';
import { mountComponent } from '../utils/component';

import BrandLogo from '../../app/components/shared/BrandLogo.vue';

const state = vi.hoisted(() => ({
  logoUrl: '/logo.svg' as string | null,
  name: 'Test Store' as string,
}));

vi.mock('../../app/composables/useTenant', () => ({
  useTenant: () => ({
    logoUrl: computed(() => state.logoUrl ?? '/logo.svg'),
    rawLogoUrl: computed(() => state.logoUrl),
    logoDarkUrl: computed(() => null),
    logoSymbolUrl: computed(() => null),
    brandName: computed(() => state.name),
    tenant: ref({
      branding: { name: state.name, logoUrl: state.logoUrl },
    }),
  }),
}));

describe('BrandLogo avatar fallback', () => {
  beforeEach(() => {
    state.logoUrl = '/logo.svg';
    state.name = 'Test Store';
  });

  it('renders the logo image when the tenant has a logoUrl', () => {
    state.logoUrl = 'https://cdn.example.com/logo.png';
    const wrapper = mountComponent(BrandLogo);

    expect(wrapper.find('img').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Test Store');
  });

  it('renders the avatar fallback with single uppercase initial when logoUrl is empty', () => {
    state.logoUrl = null;
    state.name = 'acme web shop';
    const wrapper = mountComponent(BrandLogo);

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toContain('acme web shop');
    expect(wrapper.text()).toContain('A');
    // Single letter only, not multi-initial
    const fallbackEl = wrapper.find('.font-heading');
    expect(fallbackEl.exists()).toBe(true);
    expect(fallbackEl.text().trim().length).toBe(1);
  });

  it('renders the brand name without a heading element', () => {
    // The fallback renders in the header and in the mobile nav on every page.
    // As a heading it competed with the page's own h1 — a product page ended up
    // with three of them, which is what made this visible.
    state.logoUrl = null;
    const wrapper = mountComponent(BrandLogo);

    const brandName = wrapper.find('[data-slot="brand-name"]');
    expect(brandName.exists()).toBe(true);
    expect(brandName.text()).toBe('Test Store');
    expect(wrapper.find('h1').exists()).toBe(false);
    for (const level of ['h2', 'h3', 'h4', 'h5', 'h6']) {
      expect(wrapper.find(level).exists()).toBe(false);
    }
  });

  it('uppercases diacritics correctly in the avatar fallback', () => {
    state.logoUrl = null;
    state.name = 'östra butiken';
    const wrapper = mountComponent(BrandLogo);

    expect(wrapper.text()).toContain('Ö');
    expect(wrapper.text()).toContain('östra butiken');
  });

  it('respects explicit src prop even when tenant has no logoUrl', () => {
    state.logoUrl = null;
    const wrapper = mountComponent(BrandLogo, {
      props: { src: '/custom.png' },
    });

    const img = wrapper.find('img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe('/custom.png');
  });
});

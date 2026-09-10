import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computed, ref } from 'vue';
import { mountComponent } from '../utils/component';

import BrandLogo from '../../app/components/shared/BrandLogo.vue';

const state = vi.hoisted(() => ({
  logoUrl: '/logo.svg' as string | null,
  logoDarkUrl: null as string | null,
  logoSymbolUrl: null as string | null,
  name: 'Test Store' as string,
}));

vi.mock('../../app/composables/useTenant', () => ({
  useTenant: () => ({
    logoUrl: computed(() => state.logoUrl ?? '/logo.svg'),
    rawLogoUrl: computed(() => state.logoUrl),
    logoDarkUrl: computed(() => state.logoDarkUrl),
    logoSymbolUrl: computed(() => state.logoSymbolUrl),
    brandName: computed(() => state.name),
    tenant: ref({
      branding: { name: state.name, logoUrl: state.logoUrl },
    }),
  }),
}));

describe('BrandLogo avatar fallback', () => {
  beforeEach(() => {
    state.logoUrl = '/logo.svg';
    state.logoDarkUrl = null;
    state.logoSymbolUrl = null;
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

/**
 * Driven through the config rather than through props. Logo.test.ts passes
 * `srcDark` and `srcSymbol` as props, but LayoutHeaderMain.vue:30 mounts
 * `<BrandLogo class="shrink-0" />` with none, so the app always reads these
 * two off the tenant and the prop path is one it never takes.
 */
describe('BrandLogo dark and symbol variants from the tenant config', () => {
  beforeEach(() => {
    state.logoUrl = '/logo.svg';
    state.logoDarkUrl = null;
    state.logoSymbolUrl = null;
    state.name = 'Test Store';
  });

  it('renders a second image when the tenant configures logoDarkUrl', () => {
    state.logoDarkUrl = 'https://cdn.example.com/logo-dark.png';
    const wrapper = mountComponent(BrandLogo);

    const sources = wrapper.findAll('img').map((img) => img.attributes('src'));
    expect(sources).toContain('https://cdn.example.com/logo-dark.png');
    expect(sources.length).toBeGreaterThan(1);
  });

  it('renders a single image when the tenant has no logoDarkUrl', () => {
    const wrapper = mountComponent(BrandLogo);

    const sources = wrapper.findAll('img').map((img) => img.attributes('src'));
    expect(sources).toEqual(['/logo.svg']);
  });

  it('renders the symbol image when the tenant configures logoSymbolUrl', () => {
    state.logoSymbolUrl = 'https://cdn.example.com/logo-symbol.png';
    const wrapper = mountComponent(BrandLogo);

    const sources = wrapper.findAll('img').map((img) => img.attributes('src'));
    expect(sources).toContain('https://cdn.example.com/logo-symbol.png');
  });

  it('renders no symbol image when the tenant has no logoSymbolUrl', () => {
    const wrapper = mountComponent(BrandLogo);

    const sources = wrapper.findAll('img').map((img) => img.attributes('src'));
    expect(sources).toEqual(['/logo.svg']);
  });
});

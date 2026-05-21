import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { computed, ref } from 'vue';
import { defaultMountOptions } from '../utils/component';

function mockTenant({
  logoUrl,
  name,
}: {
  logoUrl: string | null;
  name?: string;
}) {
  vi.doMock('../../app/composables/useTenant', () => ({
    useTenant: () => ({
      logoUrl: computed(() => logoUrl ?? '/logo.svg'),
      rawLogoUrl: computed(() => logoUrl),
      logoDarkUrl: computed(() => null),
      logoSymbolUrl: computed(() => null),
      brandName: computed(() => name ?? 'Test Store'),
      tenant: ref({ branding: { name, logoUrl } }),
    }),
  }));
  vi.doMock('../../app/composables/useLocaleMarket', () => ({
    useLocaleMarket: () => ({
      localePath: (p: string) => p,
      currentLocale: { value: 'sv' },
      currentMarket: { value: 'se' },
      switchLocale: vi.fn(),
      switchMarket: vi.fn(),
    }),
  }));
}

describe('BrandLogo avatar fallback', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders the logo image when the tenant has a logoUrl', async () => {
    mockTenant({ logoUrl: 'https://cdn.example.com/logo.png' });
    const BrandLogo = (
      await import('../../app/components/shared/BrandLogo.vue')
    ).default;
    const wrapper = mount(BrandLogo, defaultMountOptions);

    expect(wrapper.find('img').exists()).toBe(true);
    expect(wrapper.find('[data-slot="logo"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Test Store');
  });

  it('renders the avatar fallback with single uppercase initial when logoUrl is empty', async () => {
    mockTenant({ logoUrl: null, name: 'acme web shop' });
    const BrandLogo = (
      await import('../../app/components/shared/BrandLogo.vue')
    ).default;
    const wrapper = mount(BrandLogo, defaultMountOptions);

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toContain('A');
    expect(wrapper.text()).toContain('acme web shop');
    // Should be a single character, not multi-letter initials
    const fallback = wrapper
      .find('[data-slot="avatar-fallback"], .font-heading')
      .text();
    expect(fallback.replace(/\s/g, '').length).toBeLessThanOrEqual(2);
  });

  it('uppercases diacritics correctly in the avatar fallback', async () => {
    mockTenant({ logoUrl: null, name: 'östra butiken' });
    const BrandLogo = (
      await import('../../app/components/shared/BrandLogo.vue')
    ).default;
    const wrapper = mount(BrandLogo, defaultMountOptions);

    expect(wrapper.text()).toContain('Ö');
    expect(wrapper.text()).toContain('östra butiken');
  });

  it('respects explicit src prop even when tenant has no logoUrl', async () => {
    mockTenant({ logoUrl: null });
    const BrandLogo = (
      await import('../../app/components/shared/BrandLogo.vue')
    ).default;
    const wrapper = mount(BrandLogo, {
      ...defaultMountOptions,
      props: { src: '/custom.png' },
    });

    const img = wrapper.find('img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe('/custom.png');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { ref, computed } from 'vue';
import { mountComponent } from '../../utils/component';
import LayoutHeaderActionButtons from '../../../app/components/layout/header/LayoutHeaderActionButtons.vue';

// Mutable flag so individual tests can flip catalog mode on/off.
const isCatalogModeRef = ref(false);

vi.mock('../../../app/composables/useTenant', () => {
  const tenant = ref({
    tenantId: 'test-tenant',
    hostname: 'test.example.com',
    isActive: true,
    css: '',
    mode: 'commerce',
    branding: {
      name: 'Test Store',
      watermark: 'full',
      logoUrl: '/logo.svg',
      faviconUrl: '/favicon.ico',
    },
    theme: {
      name: 'default',
      displayName: 'Default Theme',
      colors: {
        primary: 'oklch(0.205 0 0)',
        secondary: 'oklch(0.97 0 0)',
        background: 'oklch(1 0 0)',
        foreground: 'oklch(0.145 0 0)',
        primaryForeground: 'oklch(0.985 0 0)',
        secondaryForeground: 'oklch(0.205 0 0)',
      },
      radius: '0.625rem',
    },
    features: {
      search: { enabled: true },
      authentication: { enabled: true },
      cart: { enabled: true },
    },
    locale: 'sv-SE',
    availableLocales: ['sv-SE'],
  });

  return {
    useTenant: () => ({
      tenant,
      tenantId: computed(() => tenant.value?.tenantId ?? ''),
      hostname: computed(() => tenant.value?.hostname ?? ''),
      isLoading: ref(false),
      error: ref(null),
      refresh: vi.fn(),
      theme: computed(() => tenant.value?.theme),
      branding: computed(() => tenant.value?.branding),
      logoUrl: computed(() => tenant.value?.branding?.logoUrl ?? '/logo.svg'),
      logoDarkUrl: computed(() => tenant.value?.branding?.logoDarkUrl ?? null),
      logoSymbolUrl: computed(
        () => tenant.value?.branding?.logoSymbolUrl ?? null,
      ),
      faviconUrl: computed(
        () => tenant.value?.branding?.faviconUrl ?? '/favicon.ico',
      ),
      ogImageUrl: computed(() => tenant.value?.branding?.ogImageUrl ?? null),
      brandName: computed(
        () => tenant.value?.branding?.name ?? tenant.value?.tenantId ?? 'Store',
      ),
      mode: computed(() => tenant.value?.mode ?? 'commerce'),
      isCatalogMode: isCatalogModeRef,
      watermark: computed(() => tenant.value?.branding?.watermark ?? 'full'),
      availableLocales: computed(() => ['sv']),
      availableMarkets: computed(() => []),
      market: computed(() => ''),
      imageBaseUrl: computed(() => 'https://monitor.commerce.services'),
      features: computed(() => tenant.value?.features),
      contact: computed(() => null),
      hasFeature: (name: string) => {
        const f = tenant.value?.features?.[name];
        return f ? f.enabled : false;
      },
      suspense: () => Promise.resolve(),
    }),
    useTenantTheme: () => ({
      colors: computed(() => tenant.value?.theme?.colors),
      typography: computed(() => undefined),
      radius: computed(() => tenant.value?.theme?.radius),
      getColor: () => '',
      primaryColor: computed(() => 'oklch(0.205 0 0)'),
      secondaryColor: computed(() => 'oklch(0.97 0 0)'),
      backgroundColor: computed(() => 'oklch(1 0 0)'),
      foregroundColor: computed(() => 'oklch(0.145 0 0)'),
    }),
  };
});

describe('LayoutHeaderActionButtons', () => {
  it('renders cart button', () => {
    isCatalogModeRef.value = false;
    const wrapper = mountComponent(LayoutHeaderActionButtons);
    expect(wrapper.find('[data-slot="cart-button"]').exists()).toBe(true);
  });

  it('cart button is a button element (not a link)', () => {
    isCatalogModeRef.value = false;
    const wrapper = mountComponent(LayoutHeaderActionButtons);
    const cartButton = wrapper.find('[data-slot="cart-button"]');
    expect(cartButton.element.tagName).toBe('BUTTON');
  });

  it('renders search icon button on mobile', () => {
    isCatalogModeRef.value = false;
    const wrapper = mountComponent(LayoutHeaderActionButtons);
    expect(wrapper.find('[data-slot="search-button"]').exists()).toBe(true);
  });

  it('renders hamburger button on mobile', () => {
    isCatalogModeRef.value = false;
    const wrapper = mountComponent(LayoutHeaderActionButtons);
    expect(wrapper.find('[data-slot="menu-toggle"]').exists()).toBe(true);
  });

  it('does not render cart button when catalog mode is active', () => {
    isCatalogModeRef.value = true;
    const wrapper = mountComponent(LayoutHeaderActionButtons);
    expect(wrapper.find('[data-slot="cart-button"]').exists()).toBe(false);
    isCatalogModeRef.value = false;
  });
});

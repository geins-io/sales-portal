/**
 * Component Test Setup (jsdom environment)
 *
 * Extends base setup with useTenant mock for component tests.
 * Much faster than full Nuxt environment — no registerEndpoint needed.
 */

import './setup';
import { vi } from 'vitest';
import { ref, computed } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

// Create a fresh Pinia instance for each test so stores work without Nuxt
setActivePinia(createPinia());

// Mock useTenant with the same data as setup-nuxt.ts registerEndpoint
vi.mock('../app/composables/useTenant', () => {
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
      watermark: computed(() => tenant.value?.branding?.watermark ?? 'full'),
      availableLocales: computed(() => ['sv']),
      availableMarkets: computed(() => []),
      market: computed(() => ''),
      imageBaseUrl: computed(() => 'https://monitor.commerce.services'),
      features: computed(() => tenant.value?.features),
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

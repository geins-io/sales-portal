import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick, ref } from 'vue';
import type { PublicTenantConfig } from '#shared/types/tenant-config';

const tenantRef = ref<Partial<PublicTenantConfig> | null>(null);
const route = { params: {}, path: '/cart' };

type PluginFn = (nuxtApp: unknown) => void;
let capturedPlugin: PluginFn | null = null;

vi.mock('#app/nuxt', () => ({
  defineNuxtPlugin: (plugin: PluginFn) => {
    capturedPlugin = plugin;
    return plugin;
  },
  tryUseNuxtApp: vi.fn(),
  useNuxtApp: vi.fn(),
}));

vi.mock('#app/composables/router', () => ({
  useRoute: () => route,
}));

vi.mock('../../app/composables/useTenant', () => ({
  useTenant: () => ({ tenant: tenantRef }),
}));

await import('../../app/plugins/i18n-locale');

function runPlugin() {
  const setLocale = vi.fn();
  const i18n = {
    locale: ref('sv'),
    availableLocales: ['sv', 'en'],
    setLocale,
  };
  capturedPlugin!({ $i18n: i18n });
  return setLocale;
}

describe('i18n-locale plugin', () => {
  beforeEach(() => {
    tenantRef.value = null;
    route.path = '/cart';
  });

  it("applies the tenant's default locale on an unprefixed URL", async () => {
    tenantRef.value = { locale: 'en-US' };
    const setLocale = runPlugin();
    await nextTick();
    expect(setLocale).toHaveBeenCalledWith('en');
  });

  it('waits for the tenant config before applying a locale', async () => {
    const setLocale = runPlugin();
    await nextTick();
    expect(setLocale).not.toHaveBeenCalled();

    tenantRef.value = { locale: 'en-US' };
    await nextTick();
    expect(setLocale).toHaveBeenCalledWith('en');
  });
});

import type { Composer } from 'vue-i18n';

export default defineNuxtPlugin(async (nuxtApp) => {
  const { tenant } = useTenant();
  const i18n = nuxtApp.$i18n as Composer;

  watch(
    () => {
      const raw = tenant.value;
      if (!raw) return undefined;
      return (raw as unknown as Record<string, unknown>).locale as
        | string
        | undefined;
    },
    async (tenantLocale) => {
      if (!tenantLocale) return;
      const code = tenantLocale.split('-')[0] ?? tenantLocale;
      if (code !== i18n.locale.value && isAvailableLocale(i18n, code)) {
        await i18n.setLocale(code);
      }
    },
    { immediate: true },
  );
});

/** Type guard that narrows a string to the configured locale union. */
function isAvailableLocale(
  i18n: Composer,
  code: string,
): code is Composer['locale']['value'] {
  return (i18n.availableLocales as string[]).includes(code);
}

import { findTenantBcp47 } from '~/utils/locale-bcp47';

/**
 * The BCP-47 tag to format dates and amounts with.
 *
 * Follows the active i18n locale, expanded to the tenant's own tag for it
 * ('en' -> 'en-GB') so number and date shapes match the tenant's region
 * instead of Intl's default for a bare language subtag. Falls back to the
 * short code, which Intl also accepts.
 *
 * Currency stays market-bound (ADR-020) and is passed separately.
 */
export function useFormatLocale() {
  const { locale } = useI18n();
  const { tenant } = useTenant();

  const formatLocale = computed(
    () =>
      findTenantBcp47(locale.value, tenant.value?.availableLocales) ??
      locale.value,
  );

  return { formatLocale };
}

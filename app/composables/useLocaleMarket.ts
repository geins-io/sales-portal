import { COOKIE_NAMES } from '#shared/constants/storage';
import {
  hasLocaleMarketPrefix,
  type SupportedLocale,
} from '#shared/utils/locale-market';

/**
 * Composable for URL-based locale and market routing.
 *
 * Provides reactive access to the current market/locale and helpers
 * for building locale-prefixed paths and switching locale/market.
 *
 * Validates locales and markets against the tenant config via useTenant().
 * The server middleware (server/middleware/locale-market.ts) handles
 * incoming URL parsing, validation, and cookie sync.
 */
export function useLocaleMarket() {
  const { locale: i18nLocale, setLocale } = useI18n();
  const {
    market: tenantMarket,
    availableLocales: tenantAvailableLocales,
    availableMarkets: tenantAvailableMarkets,
  } = useTenant();
  const route = useRoute();

  const marketCookie = useCookie(COOKIE_NAMES.MARKET, {
    maxAge: 365 * 24 * 60 * 60,
  });

  /** Set of valid locale short codes from tenant config. */
  const validLocales = computed(() => {
    const locales = tenantAvailableLocales.value;
    return new Set(
      Array.isArray(locales) && locales.length > 0 ? locales : ['en', 'sv'],
    );
  });

  /** Set of valid market codes from tenant config. */
  const validMarkets = computed(() => {
    const markets = tenantAvailableMarkets.value;
    return new Set(
      Array.isArray(markets) && markets.length > 0 ? markets : ['se'],
    );
  });

  /** Current market code (from cookie, falling back to tenant default). */
  const currentMarket = computed(
    () => marketCookie.value || tenantMarket.value || 'se',
  );

  /** Current locale code (from i18n state). */
  const currentLocale = computed(() => i18nLocale.value);

  /**
   * Build a locale/market-prefixed path.
   *
   * @param path - The path to prefix (e.g., '/foder', '/contact')
   * @returns The prefixed path (e.g., '/se/sv/foder')
   */
  function localePath(path: string): string {
    // Skip external URLs and protocol-relative URLs
    if (
      path.startsWith('http://') ||
      path.startsWith('https://') ||
      path.startsWith('//')
    ) {
      return path;
    }

    // Skip anchor-only and empty paths
    if (
      !path ||
      path.startsWith('#') ||
      path.startsWith('mailto:') ||
      path.startsWith('tel:')
    ) {
      return path;
    }

    const market = currentMarket.value;
    const locale = currentLocale.value;

    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    // Skip if already prefixed with a valid locale/market pair
    if (hasLocaleMarketPrefix(normalizedPath)) {
      return normalizedPath;
    }

    // For root, return with trailing slash
    if (normalizedPath === '/') {
      return `/${market}/${locale}/`;
    }

    return `/${market}/${locale}${normalizedPath}`;
  }

  /**
   * Get the current page path WITHOUT the locale/market prefix.
   * Useful when switching locale/market to reconstruct the URL.
   */
  function getCleanPath(): string {
    const fullPath = route.fullPath;
    const segments = fullPath.split('/').filter(Boolean);

    // Check if URL currently has a locale/market prefix
    if (
      segments.length >= 2 &&
      /^[a-z]{2}$/.test(segments[0]!) &&
      validLocales.value.has(segments[1]!)
    ) {
      const rest = segments.slice(2);
      return rest.length > 0 ? '/' + rest.join('/') : '/';
    }

    return fullPath;
  }

  /**
   * Switch to a different locale while staying on the same page.
   * Updates the URL, cookie, and i18n state.
   * Rejects locales not in the tenant's available locales.
   */
  async function switchLocale(locale: string) {
    if (!validLocales.value.has(locale)) return;

    await setLocale(locale as SupportedLocale);
    const cleanPath = getCleanPath();
    const market = currentMarket.value;

    await navigateTo(
      `/${market}/${locale}${cleanPath === '/' ? '/' : cleanPath}`,
      { external: true },
    );
  }

  /**
   * Switch to a different market while staying on the same page.
   * Updates the URL and cookie. Triggers a full reload because
   * market changes affect server-side data (products, prices, etc.).
   * Rejects markets not in the tenant's available markets.
   */
  async function switchMarket(market: string) {
    if (!validMarkets.value.has(market)) return;

    marketCookie.value = market;
    const cleanPath = getCleanPath();
    const locale = currentLocale.value;

    await navigateTo(
      `/${market}/${locale}${cleanPath === '/' ? '/' : cleanPath}`,
      { external: true },
    );
  }

  return {
    currentMarket,
    currentLocale,
    validLocales,
    validMarkets,
    localePath,
    getCleanPath,
    switchLocale,
    switchMarket,
  };
}

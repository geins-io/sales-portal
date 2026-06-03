import type { LocaleAlternateUrl } from '#shared/types/commerce';
import { alternateEntityPath } from '#shared/utils/route-helpers';

/**
 * Locale-switch alternate URLs.
 *
 * Decouples "where the entity's per-locale URLs come from" (Geins
 * `alternativeUrls`, or an id-based resolution fallback) from "how the
 * language switcher consumes them". Publishers push entries via
 * `setAlternates`; the switcher reads `hrefFor(short)` and falls back to
 * clean-path behavior when an alternate is absent.
 *
 * State is `useState`-backed (SSR-safe, shared per request/session) under a
 * stable key. It is cleared on every client route change so a previous page's
 * entity URLs can never leak into the switcher (the stale-data trap this
 * composable exists to prevent). SSR sets the state fresh each request, so the
 * afterEach clear is purely a client-side belt-and-suspenders.
 *
 * Live-verified facts (tenant-a.litium.portal:3000, real Geins data):
 *  - `alternativeUrls` span MANY markets/channels (en-SE, en-FI, en-US, ...);
 *    the switcher must FILTER to the current market, else last-wins can land on
 *    the wrong market (e.g. /fi/en/...).
 *  - tenant-a alternates are "pretty" SEO paths WITHOUT our /p//c//b/ type
 *    prefix (`/se/en/materials/branch-pipes/manifold-150-150-88`), so we inject
 *    the prefix after `/{market}/{locale}/`. Injecting it is routable and
 *    renders the correct target-language content.
 *  - other tenants (e.g. tinatest) DO carry the prefix
 *    (`/se/en/p/category-1/cutting-edge`); we leave those untouched (no /p/p/).
 *  - Geins may return `/l/` as the prefix for category alternates; this composable
 *    remaps those to the app `/c/` route via `alternateEntityPath`.
 *
 * HARD BLOCK: this composable only reads/derives; it must never write the
 * locale cookie. Short URL-locale codes are derived from the culture/language
 * fields and validated against tenant available locales; they are never
 * hardcoded.
 */

/**
 * Normalize a Geins `alternativeUrls` URL into a routable, same-origin app
 * route path shaped `/{market}/{locale}/{type}/...`.
 *
 * Delegates to `alternateEntityPath` which handles both live-verified shapes:
 *  - prefix-less pretty paths: inject `typePrefix` after `/{market}/{locale}/`.
 *  - already-prefixed paths: leave as-is, no double `/p/p/`.
 *  - Geins `/l/` prefix: remap to the app prefix for the entity type.
 *
 * Rejects (returns null) anything we cannot safely route: absolute http(s),
 * protocol-relative `//`, too-few segments, non-2-letter market/locale, or a
 * result that does not carry a recognized app type prefix at segment[2].
 *
 * Pure and exported so tests can exercise the inject / leave-as-is / reject
 * matrix without a Nuxt context. Query/hash are dropped; alternates are
 * canonical pages.
 *
 * `typePrefix` is the single-letter app prefix string (e.g. 'p', 'c', 'b').
 */
export function normalizeAlternatePath(
  url: string,
  typePrefix: string,
): string | null {
  const type =
    typePrefix === 'p'
      ? 'product'
      : typePrefix === 'c'
        ? 'category'
        : typePrefix === 'b'
          ? 'brand'
          : null;
  if (!type) return null;
  return alternateEntityPath(url, type);
}

/**
 * Derive the short URL-locale code for an alternate entry.
 *
 * Prefers the BCP-47 `culture` field (e.g. 'en-US' -> 'en'); falls back to
 * `language` when culture is missing/blank or does not collapse to a 2-letter
 * code. Returns undefined when neither yields a valid 2-letter code.
 */
function shortCodeFor(entry: LocaleAlternateUrl): string | undefined {
  const fromCulture = entry.culture?.split('-')[0]?.toLowerCase();
  if (fromCulture && /^[a-z]{2}$/.test(fromCulture)) return fromCulture;

  const fromLanguage = entry.language?.split('-')[0]?.toLowerCase();
  if (fromLanguage && /^[a-z]{2}$/.test(fromLanguage)) return fromLanguage;

  return undefined;
}

/** First path segment of an alternate URL, or undefined when not a path. */
function marketSegmentOf(url: string): string | undefined {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) {
    return undefined;
  }
  return url.split('?')[0]!.split('#')[0]!.split('/').filter(Boolean)[0];
}

/**
 * Pure mapping helper, exported so tests can exercise the market-filter,
 * culture/language -> short-code mapping, prefix-injection and dedup matrix
 * without a Nuxt context.
 *
 * For each entry: SKIP unless the URL's first segment matches `currentMarket`
 * (live-verified: alternates span many markets); derive the short code and keep
 * it only when in `availableShort`; map the URL through `alternateEntityPath`
 * (inject the type prefix when absent, remap /l/ to /c/ for categories),
 * SKIP when null. Builds a `Record<short, routable>`; same-market duplicates
 * across channels resolve to identical paths, so last-wins is harmless.
 */
export function mapAlternatesToShortCodes(
  entries: LocaleAlternateUrl[] | null | undefined,
  opts: {
    availableShort: string[];
    currentMarket: string;
    type: 'product' | 'category' | 'brand';
  },
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!entries) return result;

  const allowed = new Set(opts.availableShort);

  for (const entry of entries) {
    if (!entry) continue;
    if (marketSegmentOf(entry.url) !== opts.currentMarket) continue;
    const short = shortCodeFor(entry);
    if (!short || !allowed.has(short)) continue;
    const routable = alternateEntityPath(entry.url, opts.type);
    if (!routable) continue;
    result[short] = routable;
  }

  return result;
}

// Module-level guard so the router.afterEach clear is registered exactly once
// per client session, even across repeated composable calls or HMR.
let afterEachRegistered = false;

export function useLocaleAlternates() {
  const state = useState<Record<string, string>>(
    'locale-alternates',
    () => ({}),
  );
  const { availableLocales } = useTenant();
  const { currentMarket } = useLocaleMarket();

  function setAlternates(
    entries: LocaleAlternateUrl[] | null | undefined,
    opts: { type: 'product' | 'category' | 'brand' },
  ): void {
    const available = availableLocales.value.filter(
      (l): l is string => typeof l === 'string' && l.length > 0,
    );
    // currentMarket is read here at publish time (a snapshot), not subscribed
    // to. This is safe because locale and market switches are full-page reloads:
    // the component remounts and re-publishes against the fresh market, so a
    // stale-market alternate can never persist across a switch.
    state.value = mapAlternatesToShortCodes(entries, {
      availableShort: available,
      currentMarket: currentMarket.value,
      type: opts.type,
    });
  }

  function clear(): void {
    state.value = {};
  }

  function hrefFor(short: string): string | undefined {
    return state.value[short];
  }

  if (import.meta.client && !afterEachRegistered) {
    afterEachRegistered = true;
    useRouter().afterEach(() => {
      clear();
    });
  }

  return {
    alternates: readonly(state),
    setAlternates,
    clear,
    hrefFor,
  };
}

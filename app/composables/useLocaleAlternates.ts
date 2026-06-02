import type { LocaleAlternateUrl } from '#shared/types/commerce';

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
 * HARD BLOCK: this composable only reads/derives — it must never write the
 * locale cookie. Short URL-locale codes are derived from the culture/language
 * fields and validated against tenant available locales; they are never
 * hardcoded.
 */

/** Recognized type-prefix segments in app route paths. */
const TYPE_PREFIXES = new Set(['p', 'c', 'b', 'l', 's']);

/**
 * Validate that a Geins `alternativeUrls` URL is a well-formed, same-origin
 * app route path we can safely navigate to.
 *
 * We accept ONLY paths beginning with a single '/' (rejecting absolute
 * http(s) and protocol-relative '//' URLs) shaped as
 * `/{market}/{locale}/{type}/...` where `{type}` is a recognized prefix.
 * This mirrors the spirit of `isRoutableProductPath()` in ProductDetails.vue:
 * anything we cannot route is rejected so the switcher falls back to its safe
 * clean-path default instead of navigating off-origin or to a 404.
 */
function isWellFormedAlternatePath(url: string): boolean {
  if (typeof url !== 'string') return false;
  if (!url.startsWith('/')) return false;
  if (url.startsWith('//')) return false;

  const segments = url.split('?')[0]!.split('#')[0]!.split('/').filter(Boolean);
  // /{market}/{locale}/{type}/...
  if (segments.length < 4) return false;
  if (!/^[a-z]{2}$/.test(segments[0]!)) return false;
  if (!/^[a-z]{2}$/.test(segments[1]!)) return false;
  return TYPE_PREFIXES.has(segments[2]!);
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

/**
 * Pure mapping helper — exported so tests can exercise the
 * culture/language -> short-code mapping and URL-validation matrix without a
 * Nuxt context.
 *
 * For each entry: derive the short code, keep it only when the short code is
 * in `availableShort` AND the URL is a well-formed type-prefixed path. Builds
 * a `Record<short, url>`; last entry wins (one entry per language expected).
 */
export function mapAlternatesToShortCodes(
  entries: LocaleAlternateUrl[] | null | undefined,
  availableShort: string[],
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!entries) return result;

  const allowed = new Set(availableShort);

  for (const entry of entries) {
    if (!entry) continue;
    const short = shortCodeFor(entry);
    if (!short || !allowed.has(short)) continue;
    if (!isWellFormedAlternatePath(entry.url)) continue;
    result[short] = entry.url;
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

  function setAlternates(
    entries: LocaleAlternateUrl[] | null | undefined,
  ): void {
    const available = availableLocales.value.filter(
      (l): l is string => typeof l === 'string' && l.length > 0,
    );
    state.value = mapAlternatesToShortCodes(entries, available);
  }

  function clear(): void {
    state.value = {};
  }

  function hrefFor(short: string): string | undefined {
    return state.value[short];
  }

  if (!afterEachRegistered) {
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

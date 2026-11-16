import { parseLocaleMarketPrefix } from '#shared/utils/locale-market';

interface PageLocation {
  origin: string;
  pathname: string;
}

/**
 * The fetch input with the locale of the page's URL added as `?locale=`, for
 * a call to our own `/api` routes on this site. The market is not added: it
 * binds the currency and stays the cookie's. Any other call, one that names
 * its own locale, a page without a prefix and a `Request` object are left as
 * they are.
 */
export function withPageLocale<T extends RequestInfo | URL>(
  input: T,
  page: PageLocation,
): T {
  if (typeof input !== 'string' && !(input instanceof URL)) return input;
  const pair = parseLocaleMarketPrefix(page.pathname);
  if (!pair) return input;

  const url = new URL(input, page.origin);
  if (
    url.origin !== page.origin ||
    !url.pathname.startsWith('/api/') ||
    url.searchParams.has('locale')
  ) {
    return input;
  }
  url.searchParams.set('locale', pair.locale);

  if (input instanceof URL) return url as T;
  return (
    input.startsWith('/') ? `${url.pathname}${url.search}${url.hash}` : url.href
  ) as T;
}

/**
 * Sends the current page's locale with every fetch to our own `/api` routes.
 * The cookie cannot carry it: it holds the language of the last page any tab
 * loaded, and the browser caches an answer by its URL.
 */
export function sendPageLocaleWithFetch(
  target: { fetch: typeof fetch },
  page: () => PageLocation,
): void {
  const original = target.fetch;
  target.fetch = (input, init) => original(withPageLocale(input, page()), init);
}

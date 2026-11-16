import type { H3Event } from 'h3';

type FetchOptions = {
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
};

// Nitro's route-typed `$fetch` is too deep for the compiler to compare with a
// plain call (as in `app/utils/internal-fetch.ts`); the wrapper only passes
// requests through, so it is typed by what it does.
type PassThroughFetch = (request: unknown, init?: FetchOptions) => unknown;

/** Whether a call names its own locale, in its URL or options. */
function namesItsOwnLocale(url: string, init?: FetchOptions): boolean {
  const search = new URLSearchParams(url.split('#')[0]!.split('?')[1] ?? '');
  return (
    search.has('locale') || 'locale' in { ...init?.params, ...init?.query }
  );
}

/**
 * Sends the locale of a page request with every call its render makes to our
 * own `/api` routes, as `?locale=`. The market is not sent: it binds the
 * currency and stays the cookie's (ADR-020).
 *
 * The render calls them through `event.$fetch` (useFetch, internalFetch and
 * useRequestFetch all do), which forwards the cookie the browser sent. That
 * cookie still holds the language of the previous page; the new one is only
 * set on this response. A call that names its own locale keeps it.
 */
export function sendPageLocaleWithApiCalls(
  event: H3Event,
  locale: string,
): void {
  const pageFetch = event.$fetch as unknown as PassThroughFetch;
  const withPair: PassThroughFetch = (request, init) => {
    if (
      typeof request !== 'string' ||
      !request.startsWith('/api/') ||
      namesItsOwnLocale(request, init)
    ) {
      return pageFetch(request, init);
    }
    return pageFetch(request, {
      ...init,
      query: { locale, ...init?.query },
    });
  };
  event.$fetch = withPair as unknown as typeof event.$fetch;
}

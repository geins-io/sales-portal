import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Matching a call to one of our own `/api` routes by its pathname alone.
 *
 * Every browser call to `/api/` carries the page's `?locale=` (ADR-026), so a
 * pattern on the whole URL misses it. An intercept that misses fails open: the
 * request reaches the server, and a write the test meant to answer itself
 * happens for real. Match with these instead of a URL string; the lint rule
 * `sales-portal/no-api-url-literal` holds tests/e2e to it.
 *
 * `path` is the route's pathname. `*` stands for one segment; a trailing `/**`
 * also matches everything below it.
 */
export function isApiCall(url: string | URL, path: string): boolean {
  const pathname = new URL(url, 'http://localhost').pathname;
  const below = path.endsWith('/**');
  const segments = (below ? path.slice(0, -3) : path)
    .split('/')
    .map((segment) =>
      segment === '*'
        ? '[^/]+'
        : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
  return new RegExp(`^${segments.join('/')}${below ? '(/.*)?' : ''}$`).test(
    pathname,
  );
}

/** For `page.route`, `context.route` and `unroute`: the call by its pathname. */
export function apiRoute(path: string): (url: URL) => boolean {
  return (url) => isApiCall(url, path);
}

/** The statuses ofetch retries a GET on (ofetch 1.5.1, `retryStatusCodes`). */
const RETRY_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

/**
 * A GET of one of our own `/api` routes, retried once the way the page's
 * `useFetch`/`$fetch` (ofetch) retries it: on the statuses above, or when the
 * call threw. Without it, one stalled Geins call fails a test that a buyer
 * would not have noticed. Writes never go through here: ofetch does not retry
 * them either. The lint rule `sales-portal/api-get-through-helper` holds
 * tests/e2e to it.
 */
export async function apiGet(
  request: APIRequestContext,
  url: string,
  options?: Parameters<APIRequestContext['get']>[1],
): Promise<APIResponse> {
  try {
    const response = await request.get(url, options);
    if (!RETRY_STATUSES.has(response.status())) return response;
  } catch {
    // ofetch counts a call without an answer as a 500 and retries it.
  }
  return request.get(url, options);
}

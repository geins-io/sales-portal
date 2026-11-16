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

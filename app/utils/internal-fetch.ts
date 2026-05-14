import type { NitroFetchOptions, NitroFetchRequest } from 'nitropack';

/**
 * Same-origin `$fetch` that forwards the incoming request's cookie header
 * during SSR so auth-gated Nitro routes see the user's session.
 *
 * Use this for every call to our own `/api/*` routes from a store, composable,
 * or any other non-page context. `useFetch` does this automatically for
 * page-level data loads.
 *
 * The companion `$api` (`app/plugins/api.ts`) is for calls to the external
 * Geins API; it strips cookies on purpose so our session does not leak to
 * a third party. Do not use it for internal routes.
 *
 * See `docs/conventions/api-clients.md`.
 */
export function internalFetch<T>(
  url: string,
  options: NitroFetchOptions<NitroFetchRequest> = {},
): Promise<T> {
  const headers = import.meta.server
    ? { ...useRequestHeaders(['cookie']), ...(options.headers ?? {}) }
    : options.headers;
  return $fetch<T>(url, { ...options, headers });
}

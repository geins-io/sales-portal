import type { NitroFetchOptions, NitroFetchRequest } from 'nitropack';

type InternalFetcher = <T>(
  url: string,
  options?: NitroFetchOptions<NitroFetchRequest>,
) => Promise<T>;

/**
 * Exported for tests: the fetcher for the environment. On the server it is the
 * request-bound `event.$fetch` behind `useRequestFetch()`; on the client the
 * global `$fetch`. Split out because `import.meta.server` is replaced at build
 * time and cannot be flipped in a unit test. Each branch is wrapped rather
 * than returned as-is: the two fetch types differ in their route typing and
 * their union is too deep for the compiler to compare.
 */
export function internalFetcher(server: boolean): InternalFetcher {
  if (server) {
    const requestFetch = useRequestFetch();
    return <T>(url: string, options?: NitroFetchOptions<NitroFetchRequest>) =>
      requestFetch<T>(url, options);
  }
  return <T>(url: string, options?: NitroFetchOptions<NitroFetchRequest>) =>
    $fetch<T>(url, options);
}

/**
 * Same-origin `$fetch` for our own `/api/*` routes that, during SSR, forwards
 * the incoming request's headers to the internal hop: `host`, `cookie`,
 * `x-forwarded-proto` and the rest (h3 drops only hop-by-hop headers and
 * `accept`). Without `host` the internal request resolves the tenant as
 * `localhost`, which the merchant API answers with a real tenant — the call
 * then runs with another tenant's credentials. Without `cookie` an auth-gated
 * route answers 401. See `docs/patterns/internal-fetch.md`.
 *
 * Use this for every call to our own `/api/*` routes from a store, composable,
 * middleware or any other non-page context. `useFetch` does the same
 * forwarding for page-level data loads. `options.headers` are merged on top.
 *
 * The companion `$api` (`app/plugins/api.ts`) targets the same `/api` routes
 * but adds retry-with-backoff, and forwards a header allowlist that excludes
 * `cookie`. Prefer this helper unless a call specifically needs the retries;
 * `$api` cannot authenticate an auth-gated route during SSR.
 *
 * See `docs/conventions/api-clients.md`.
 */
export function internalFetch<T>(
  url: string,
  options: NitroFetchOptions<NitroFetchRequest> = {},
): Promise<T> {
  return internalFetcher(import.meta.server)<T>(url, options);
}

import { isSafeInternalPath } from '#shared/utils/redirect';

/**
 * Auth Redirect Plugin (client-only)
 *
 * Wraps the global `$fetch` so that any API response with
 * `statusCode === 401` AND `data.code === 'SESSION_EXPIRED'` triggers a
 * client-side redirect to the login page with the current path preserved
 * in a `redirect` query param.
 *
 * Why wrap `globalThis.$fetch`: Nuxt's `useFetch` ultimately calls
 * `globalThis.$fetch`, so replacing it here covers both direct `$fetch()`
 * callers and `useFetch()` consumers (including SSR-initiated fetches
 * that hydrate on the client).
 *
 * Only the exact `SESSION_EXPIRED` code triggers the redirect — plain 401s
 * from unauthorized access to someone else's data are left alone so the
 * calling component can still render its own error state.
 */

/** Narrow shape of the `data` payload returned by `createAppError`. */
interface SessionExpiredErrorData {
  code?: string;
}

/** Minimal shape of an ofetch response error we care about. */
export interface AuthFetchError {
  response?: {
    status?: number;
    _data?: { data?: SessionExpiredErrorData } | null;
  };
}

/**
 * Decide whether a fetch error represents an expired session that the
 * interceptor should handle. Pure function — safe to unit-test.
 */
export function isSessionExpiredError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const response = (error as AuthFetchError).response;
  if (!response || response.status !== 401) return false;
  const data = response._data?.data;
  return data?.code === 'SESSION_EXPIRED';
}

/**
 * Build the login redirect URL. Guards against redirect loops (already on
 * /login) and uses `isSafeInternalPath` so attacker-controlled values from
 * the current URL can never lead to an open redirect.
 *
 * Returns `null` when no redirect should happen.
 */
export function buildLoginRedirect(params: {
  loginPath: string;
  currentPath: string;
}): string | null {
  const { loginPath, currentPath } = params;

  // Never redirect when the user is already on a login page — this prevents
  // loops when the login page itself makes an authenticated API call.
  // Use a segment-anchored match so sibling paths like `/login-as-user` or
  // `/checkout/login-return` still get redirected normally. Strip any trailing
  // query string first so `/login?redirect=...` is still recognised as login.
  const pathOnly = currentPath.split('?')[0] ?? currentPath;
  const segments = pathOnly.split('/').filter(Boolean);
  if (segments.includes('login')) {
    return null;
  }

  // Only preserve the current path if it's a safe in-app path.
  const redirectTarget = isSafeInternalPath(currentPath) ? currentPath : null;

  if (!redirectTarget) {
    return loginPath;
  }

  return `${loginPath}?redirect=${encodeURIComponent(redirectTarget)}`;
}

export default defineNuxtPlugin((nuxtApp) => {
  // Capture the original `$fetch` once so we can forward calls through it.
  const originalFetch = globalThis.$fetch;

  // ---------------------------------------------------------------------
  // onResponseError composition gotcha
  // ---------------------------------------------------------------------
  // `originalFetch.create(...)` sets a default `onResponseError` on the
  // returned instance. When a caller passes `$fetch(url, { onResponseError })`,
  // ofetch REPLACES this default rather than composing both hooks.
  //
  // Today there are zero callers that override `onResponseError` per-call,
  // so the session-expired redirect always fires. If you're about to add
  // a per-call interceptor, EITHER:
  //   1. Re-throw the original error inside your hook so the wrapped
  //      instance's logic still runs at the call site, OR
  //   2. Inline the `isSessionExpiredError` check + `buildLoginRedirect`
  //      call into your handler (and keep them in sync with this file).
  //
  // Ofetch does not currently expose a way to chain multiple
  // `onResponseError` hooks on a single fetch call.
  // ---------------------------------------------------------------------
  const wrapped = originalFetch.create({
    async onResponseError({ response }) {
      if (!isSessionExpiredError({ response })) return;

      await nuxtApp.runWithContext(async () => {
        const route = useRoute();
        const { localePath } = useLocaleMarket();

        const target = buildLoginRedirect({
          loginPath: localePath('/login'),
          currentPath: route.fullPath,
        });

        if (!target) return;

        // Kick off the navigation. ofetch will still reject the original
        // promise, but the calling view is about to unmount as we leave
        // the current route, so the error blob never renders.
        await navigateTo(target);
      });
    },
  });

  // Replace globalThis.$fetch so both `$fetch(...)` and `useFetch(...)`
  // go through the wrapped instance.
  globalThis.$fetch = wrapped;
});

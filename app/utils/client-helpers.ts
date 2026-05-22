/**
 * SSR-safe browser API helpers.
 *
 * All browser APIs (window, document, navigator) are unavailable during SSR.
 * Use these helpers instead of accessing globals directly to prevent crashes.
 *
 * @see docs/conventions/ssr.md
 */

/**
 * Safely call window.confirm. Returns true on server (skip confirmation).
 */
export function safeConfirm(message: string): boolean {
  if (!import.meta.client) return true;
  return window.confirm(message);
}

/**
 * Safely call window.scrollTo. No-op on server.
 */
export function safeScrollTo(options?: ScrollToOptions): void {
  if (!import.meta.client) return;
  window.scrollTo(options ?? { top: 0 });
}

/**
 * Safely redirect to an external absolute URL. No-op on server.
 *
 * Delegates to Nuxt's `navigateTo({ external: true })` so the same
 * navigation primitive is used storefront-wide. Behaviour for an
 * absolute external URL is identical to a direct `window.location.href`
 * assignment: a full document load to the target.
 */
export function safeLocationRedirect(url: string): void {
  if (!import.meta.client) return;
  void navigateTo(url, { external: true });
}

/**
 * Safely access window.history. Returns fallback on server.
 */
export function safeHistoryBack(fallbackPath?: string): void {
  if (!import.meta.client) {
    if (fallbackPath) navigateTo(fallbackPath);
    return;
  }
  if (window.history.length > 1) {
    window.history.back();
  } else if (fallbackPath) {
    navigateTo(fallbackPath);
  }
}

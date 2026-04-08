/**
 * SSR-safe browser API helpers.
 *
 * All browser APIs (window, document, navigator) are unavailable during SSR.
 * Use these helpers instead of accessing globals directly to prevent crashes.
 *
 * @see docs/conventions/ssr.md
 */

/**
 * Safely call window.confirm — returns true on server (skip confirmation).
 */
export function safeConfirm(message: string): boolean {
  if (!import.meta.client) return true;
  return window.confirm(message);
}

/**
 * Safely call window.scrollTo — no-op on server.
 */
export function safeScrollTo(options?: ScrollToOptions): void {
  if (!import.meta.client) return;
  window.scrollTo(options ?? { top: 0 });
}

/**
 * Safely redirect via window.location.href — no-op on server.
 * For most cases, prefer navigateTo() with { external: true } instead.
 */
export function safeLocationRedirect(url: string): void {
  if (!import.meta.client) return;
  window.location.href = url;
}

/**
 * Safely access window.history — returns fallback on server.
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

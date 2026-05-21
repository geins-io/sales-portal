import { useAuthStore } from '~/stores/auth';

/**
 * Auth Init Plugin (universal)
 *
 * Resolves the user's auth state once per page render so the first paint
 * already reflects logged-in status — no flash of logged-out UI followed by
 * a swap to logged-in chrome on hydration.
 *
 * Server: awaits the /api/auth/me round-trip so SSR HTML is correct.
 * Client: fires the request but does NOT await — auth middleware and any
 *   page setup that needs the user awaits the same deduplicated promise.
 */
export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore();

  if (authStore.isInitialized) return;

  if (import.meta.server) {
    await authStore.fetchUser();
  } else {
    // Fire-and-forget: starts the fetch, middleware awaits the same promise
    authStore.fetchUser();
  }
});

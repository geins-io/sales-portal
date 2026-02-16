import { useAuthStore } from '~/stores/auth';

/**
 * Auth Init Plugin (client-only)
 *
 * Fires the auth session check early, in parallel with tenant loading.
 * Does NOT await — middleware will await the same deduplicated promise.
 * This saves ~50-150ms on first navigation to protected routes.
 */
export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();

  if (!authStore.isInitialized) {
    // Fire-and-forget: starts the fetch, middleware awaits the same promise
    authStore.fetchUser();
  }
});

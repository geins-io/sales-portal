import { useAuthStore } from '~/stores/auth';

/**
 * Single source of truth for the logout flow.
 *
 * Clears the session via the auth store, then performs an external
 * navigation to the localized home page. The full reload is deliberate:
 * it drops cached useFetch/useAsyncData state tied to the previous
 * session (auth-gated prices, CMS slots, the cart pricelist).
 */
export function useLogout() {
  const authStore = useAuthStore();
  const { localePath } = useLocaleMarket();

  async function logout(): Promise<void> {
    await authStore.logout();
    navigateTo(localePath('/'), { external: true });
  }

  return { logout };
}

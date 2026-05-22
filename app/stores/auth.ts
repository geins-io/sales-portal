import { defineStore } from 'pinia';
import type { AuthUser } from '@geins/types';
import { logger } from '~/utils/logger';
import { useCartStore } from '~/stores/cart';

let _fetchPromise: Promise<void> | null = null;

export type AuthSheetView = 'login' | 'forgot';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const isLoading = ref(false);
  const isInitialized = ref(false);
  const error = ref<string | null>(null);
  const sheetOpen = ref(false);
  const sheetView = ref<AuthSheetView>('login');

  function openSheet(view: AuthSheetView = 'login') {
    sheetView.value = view;
    sheetOpen.value = true;
  }

  function closeSheet() {
    sheetOpen.value = false;
  }

  // Getters
  const isAuthenticated = computed(() => !!user.value);
  const displayName = computed(() => user.value?.username ?? null);

  function hasRole(role: string): boolean {
    return user.value?.customerType === role;
  }

  function hasAnyRole(roles: string[]): boolean {
    if (!user.value?.customerType) return false;
    return roles.includes(user.value.customerType);
  }

  // Actions
  async function login(credentials: {
    username: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<AuthUser> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch('/api/auth/login', {
        method: 'POST',
        body: credentials,
      });

      error.value = null;
      user.value = response.user ?? null;

      // Refresh cart so pricelist prices from the new authenticated cart
      // are reflected immediately without a page reload.
      useCartStore()
        .fetchCart()
        .catch(() => {});

      // Server resolved a different market than the URL is currently on
      // (buyer's pricelist currency belongs to another market). Full reload
      // to /{newMarket}/{locale}/<path> so SSR re-renders the storefront
      // against the matching catalog/currency.
      if (response.market) {
        reloadToMarket(response.market);
      }

      return response.user!;
    } catch (err) {
      if (import.meta.dev) console.error('Login error:', err);
      error.value = 'auth.login_failed';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function register(credentials: {
    username: string;
    password: string;
    user?: Record<string, unknown>;
  }): Promise<AuthUser> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch('/api/auth/register', {
        method: 'POST',
        body: credentials,
      });

      user.value = response.user ?? null;
      return response.user!;
    } catch (err) {
      if (import.meta.dev) console.error('Register error:', err);
      error.value = 'auth.register_failed';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function logout(): Promise<void> {
    isLoading.value = true;

    try {
      await $fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout API errors — server cleared cookies regardless
    } finally {
      user.value = null;
      error.value = null;
      isLoading.value = false;
    }
  }

  async function fetchUser(): Promise<void> {
    if (_fetchPromise) return _fetchPromise;

    _fetchPromise = (async () => {
      try {
        const response = await internalFetch<{
          user: AuthUser | null;
          market?: string | null;
        }>('/api/auth/me');
        user.value = response.user ?? null;
        // Session restore detected a market mismatch: full reload to the
        // market the buyer is allowed on. Skip on SSR (no window).
        if (response.market && import.meta.client) {
          reloadToMarket(response.market);
        }
      } catch {
        user.value = null;
        logger.warn('Failed to fetch current user');
      } finally {
        isInitialized.value = true;
        _fetchPromise = null;
      }
    })();

    return _fetchPromise;
  }

  /**
   * Full-reload the storefront onto a new market URL prefix. Server already
   * set the new market cookie, we navigate via a hard reload so the next
   * SSR pass reads the cookie and renders the matching catalog/currency.
   *
   * Uses `window.location.assign` instead of `navigateTo({external: true})`
   * because this only runs on the client (gated by the caller) and
   * `assign` is a true full document load that resets Pinia, i18n, theme
   * and SDK state in one shot.
   */
  function reloadToMarket(newMarket: string): void {
    if (typeof window === 'undefined') return;
    const segments = window.location.pathname.split('/').filter(Boolean);
    const currentMarket = segments[0];
    const currentLocale = segments[1] ?? 'sv';
    if (currentMarket === newMarket) return;
    const rest = segments.slice(2).join('/');
    const target = `/${newMarket}/${currentLocale}${rest ? '/' + rest : '/'}`;
    window.location.assign(target);
  }

  function setUser(newUser: AuthUser) {
    user.value = newUser;
  }

  function clearError() {
    error.value = null;
  }

  async function requestPasswordReset(email: string): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      await $fetch('/api/auth/forgot-password', {
        method: 'POST',
        body: { email },
      });
    } finally {
      isLoading.value = false;
    }
  }

  async function resetPassword(
    resetKey: string,
    password: string,
  ): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      await $fetch('/api/auth/reset-password', {
        method: 'POST',
        body: { resetKey, password },
      });
    } catch (err) {
      if (import.meta.dev) console.error('Reset password error:', err);
      error.value = 'auth.reset_failed';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    // State
    user,
    isLoading,
    isInitialized,
    error,
    sheetOpen,
    sheetView,
    // Getters
    isAuthenticated,
    displayName,
    hasRole,
    hasAnyRole,
    // Actions
    login,
    register,
    logout,
    fetchUser,
    setUser,
    clearError,
    requestPasswordReset,
    resetPassword,
    openSheet,
    closeSheet,
  };
});

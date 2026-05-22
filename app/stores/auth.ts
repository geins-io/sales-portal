import { defineStore } from 'pinia';
import type { AuthUser } from '@geins/types';
import { logger } from '~/utils/logger';
import { swapMarketInPath } from '#shared/utils/locale-market';

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

      // Intentionally do NOT assign `user.value = response.user` here.
      // Doing so would trigger a re-render of the topbar (showing the
      // authenticated email) for a frame before the reload tears the page
      // down, producing a visible "email -> white flash -> reload" sequence.
      // The reload below re-runs SSR which re-fetches /api/auth/me and
      // populates the store atomically with the first paint.
      if (import.meta.client) {
        const current = window.location.pathname;
        const target = response.market
          ? swapMarketInPath(current, response.market)
          : current;

        if (target !== current) {
          // Market changed: cross-prefix navigation needs a true external
          // nav so the new SSR pass reads the matching market cookie.
          await navigateTo(target, { external: true, replace: true });
        } else {
          // Same URL: re-run SSR in place so auth-gated prices, CMS slots
          // and the cart pricelist reflect the now-authenticated session.
          // reloadNuxtApp is fire-and-forget, do not await.
          reloadNuxtApp({ force: true, path: target, ttl: 1000 });
        }
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
        // market the buyer is allowed on. Skip on SSR (no window). Guard
        // against loops by short-circuiting when the swapped target equals
        // the current pathname.
        if (response.market && import.meta.client) {
          const current = window.location.pathname;
          const target = swapMarketInPath(current, response.market);
          if (target !== current) {
            await navigateTo(target, { external: true, replace: true });
          }
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

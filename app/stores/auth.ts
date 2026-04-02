import { defineStore } from 'pinia';
import type { AuthUser } from '@geins/types';
import { logger } from '~/utils/logger';

let _fetchPromise: Promise<void> | null = null;

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const isLoading = ref(false);
  const isInitialized = ref(false);
  const error = ref<string | null>(null);

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

      user.value = response.user ?? null;
      return response.user!;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'auth.login_failed';
      error.value = message;
      throw new Error(message);
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
      const message =
        err instanceof Error ? err.message : 'auth.register_failed';
      error.value = message;
      throw new Error(message);
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
        // Forward cookies during SSR so auth token reaches /api/auth/me
        const headers = import.meta.server
          ? useRequestHeaders(['cookie'])
          : undefined;
        const response = await $fetch('/api/auth/me', { headers });
        user.value = response.user ?? null;
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
      const message = err instanceof Error ? err.message : 'auth.reset_failed';
      error.value = message;
      throw new Error(message);
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
  };
});

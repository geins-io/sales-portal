import { defineStore } from 'pinia';
import type { AuthUser } from '@geins/types';
import { logger } from '~/utils/logger';

interface AuthState {
  /** Currently authenticated user */
  user: AuthUser | null;
  /** Loading state for async operations */
  isLoading: boolean;
  /** Whether auth has been initialized (session checked) */
  isInitialized: boolean;
  /** Error message from last failed operation */
  error: string | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    isLoading: false,
    isInitialized: false,
    error: null,
  }),

  getters: {
    isAuthenticated: (state): boolean => !!state.user,

    displayName: (state): string | null => {
      if (!state.user) return null;
      return state.user.username ?? null;
    },

    hasRole:
      (state) =>
      (role: string): boolean => {
        return state.user?.customerType === role;
      },

    hasAnyRole:
      (state) =>
      (roles: string[]): boolean => {
        if (!state.user?.customerType) return false;
        return roles.includes(state.user.customerType);
      },
  },

  actions: {
    async login(credentials: {
      username: string;
      password: string;
    }): Promise<AuthUser> {
      this.isLoading = true;
      this.error = null;

      try {
        const response = await $fetch('/api/auth/login', {
          method: 'POST',
          body: credentials,
        });

        this.user = response.user ?? null;
        return response.user!;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Login failed. Please try again.';
        this.error = message;
        throw new Error(message);
      } finally {
        this.isLoading = false;
      }
    },

    async register(credentials: {
      username: string;
      password: string;
      user?: Record<string, unknown>;
    }): Promise<AuthUser> {
      this.isLoading = true;
      this.error = null;

      try {
        const response = await $fetch('/api/auth/register', {
          method: 'POST',
          body: credentials,
        });

        this.user = response.user ?? null;
        return response.user!;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Registration failed. Please try again.';
        this.error = message;
        throw new Error(message);
      } finally {
        this.isLoading = false;
      }
    },

    async logout(): Promise<void> {
      this.isLoading = true;

      try {
        await $fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // Ignore logout API errors — server cleared cookies regardless
      } finally {
        this.user = null;
        this.error = null;
        this.isLoading = false;
      }
    },

    async fetchUser(): Promise<void> {
      try {
        const response = await $fetch('/api/auth/me');
        this.user = response.user ?? null;
      } catch {
        this.user = null;
        logger.warn('Failed to fetch current user');
      } finally {
        this.isInitialized = true;
      }
    },

    setUser(user: AuthUser) {
      this.user = user;
    },

    clearError() {
      this.error = null;
    },
  },
});

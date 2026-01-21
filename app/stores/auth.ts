import { defineStore } from 'pinia';
import type { User, LoginCredentials, AuthResponse } from '#shared/types';

/**
 * Authentication state interface
 */
interface AuthState {
  /** Currently authenticated user */
  user: User | null;
  /** Authentication token (JWT or similar) */
  token: string | null;
  /** Token expiration timestamp */
  expiresAt: string | null;
  /** Refresh token for token renewal */
  refreshToken: string | null;
  /** Loading state for async operations */
  isLoading: boolean;
  /** Error message from last failed operation */
  error: string | null;
}

/**
 * Token storage keys
 */
const TOKEN_STORAGE_KEY = 'auth_token';
const REFRESH_TOKEN_STORAGE_KEY = 'auth_refresh_token';
const USER_STORAGE_KEY = 'auth_user';
const EXPIRES_AT_STORAGE_KEY = 'auth_expires_at';

/**
 * Authentication Store
 *
 * Manages authentication state including user info, tokens, and session management.
 * Provides actions for login, logout, and token refresh.
 *
 * @example
 * ```vue
 * <script setup>
 * const authStore = useAuthStore();
 *
 * // Check if authenticated
 * if (authStore.isAuthenticated) {
 *   console.log('User:', authStore.user);
 * }
 *
 * // Login
 * await authStore.login({ email: 'user@example.com', password: 'password' });
 *
 * // Logout
 * await authStore.logout();
 * </script>
 * ```
 */
export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: null,
    expiresAt: null,
    refreshToken: null,
    isLoading: false,
    error: null,
  }),

  getters: {
    /**
     * Check if user is authenticated
     * A user is authenticated if they have a valid token
     */
    isAuthenticated: (state): boolean => {
      if (!state.token) return false;

      // Check if token is expired
      if (state.expiresAt) {
        const expiresAt = new Date(state.expiresAt);
        if (expiresAt <= new Date()) {
          return false;
        }
      }

      return true;
    },

    /**
     * Get the user's display name
     */
    displayName: (state): string | null => {
      if (!state.user) return null;

      if (state.user.name) return state.user.name;
      if (state.user.firstName && state.user.lastName) {
        return `${state.user.firstName} ${state.user.lastName}`;
      }
      if (state.user.firstName) return state.user.firstName;

      return state.user.email;
    },

    /**
     * Get the user's initials for avatar display
     */
    userInitials: (state): string | null => {
      if (!state.user) return null;

      if (state.user.firstName && state.user.lastName) {
        return `${state.user.firstName.charAt(0)}${state.user.lastName.charAt(0)}`.toUpperCase();
      }
      if (state.user.name) {
        const parts = state.user.name.split(' ').filter((p) => p.length > 0);
        if (parts.length >= 2 && parts[0] && parts[1]) {
          return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
        }
        if (state.user.name.length > 0) {
          return state.user.name.charAt(0).toUpperCase();
        }
      }

      if (state.user.email.length > 0) {
        return state.user.email.charAt(0).toUpperCase();
      }

      return null;
    },

    /**
     * Check if user has a specific role
     */
    hasRole:
      (state) =>
      (role: string): boolean => {
        return state.user?.roles?.includes(role) ?? false;
      },

    /**
     * Check if user has any of the specified roles
     */
    hasAnyRole:
      (state) =>
      (roles: string[]): boolean => {
        return roles.some((role) => state.user?.roles?.includes(role));
      },
  },

  actions: {
    /**
     * Initialize auth state from storage
     * Call this on app startup to restore session
     */
    initializeFromStorage() {
      if (!import.meta.client) return;

      try {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
        const expiresAt = localStorage.getItem(EXPIRES_AT_STORAGE_KEY);
        const userJson = localStorage.getItem(USER_STORAGE_KEY);

        if (token) {
          this.token = token;
          this.refreshToken = refreshToken;
          this.expiresAt = expiresAt;

          if (userJson) {
            try {
              this.user = JSON.parse(userJson);
            } catch {
              // Invalid JSON, clear user
              this.user = null;
            }
          }

          // Check if token is expired
          if (expiresAt) {
            const expiresAtDate = new Date(expiresAt);
            if (expiresAtDate <= new Date()) {
              // Token expired, try to refresh or clear
              if (refreshToken) {
                // Attempt to refresh token (fire and forget)
                this.refreshAuthToken().catch(() => {
                  this.clearAuth();
                });
              } else {
                this.clearAuth();
              }
            }
          }
        }
      } catch {
        // Storage access failed, continue without stored auth
        console.warn('Failed to initialize auth from storage');
      }
    },

    /**
     * Store authentication data in localStorage
     */
    persistToStorage() {
      if (!import.meta.client) return;

      try {
        if (this.token) {
          localStorage.setItem(TOKEN_STORAGE_KEY, this.token);
        } else {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }

        if (this.refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, this.refreshToken);
        } else {
          localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
        }

        if (this.expiresAt) {
          localStorage.setItem(EXPIRES_AT_STORAGE_KEY, this.expiresAt);
        } else {
          localStorage.removeItem(EXPIRES_AT_STORAGE_KEY);
        }

        if (this.user) {
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(this.user));
        } else {
          localStorage.removeItem(USER_STORAGE_KEY);
        }
      } catch {
        console.warn('Failed to persist auth to storage');
      }
    },

    /**
     * Clear all stored authentication data
     */
    clearStorage() {
      if (!import.meta.client) return;

      try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
        localStorage.removeItem(EXPIRES_AT_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
      } catch {
        console.warn('Failed to clear auth storage');
      }
    },

    /**
     * Login with credentials
     *
     * @param credentials - Login credentials (email, password)
     * @returns Promise resolving to authenticated user
     * @throws Error if login fails
     */
    async login(credentials: LoginCredentials): Promise<User> {
      this.isLoading = true;
      this.error = null;

      try {
        // TODO: Replace with actual API call using useApi or $fetch
        // This is a placeholder that should be replaced with real auth implementation
        const response = await $fetch<AuthResponse>('/api/auth/login', {
          method: 'POST',
          body: credentials,
        });

        this.setAuthFromResponse(response);
        return response.user;
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

    /**
     * Logout the current user
     */
    async logout(): Promise<void> {
      this.isLoading = true;

      try {
        // TODO: Call logout API endpoint if needed
        // await $fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // Ignore logout API errors, clear local state anyway
      } finally {
        this.clearAuth();
        this.isLoading = false;
      }
    },

    /**
     * Refresh the authentication token
     *
     * @returns Promise resolving to new token
     * @throws Error if refresh fails
     */
    async refreshAuthToken(): Promise<string> {
      if (!this.refreshToken) {
        throw new Error('No refresh token available');
      }

      this.isLoading = true;

      try {
        // TODO: Replace with actual API call
        const response = await $fetch<AuthResponse>('/api/auth/refresh', {
          method: 'POST',
          body: { refreshToken: this.refreshToken },
        });

        this.setAuthFromResponse(response);
        return response.token;
      } catch (err) {
        // Refresh failed, clear auth
        this.clearAuth();
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Set authentication state from API response
     */
    setAuthFromResponse(response: AuthResponse) {
      this.user = response.user;
      this.token = response.token;
      this.expiresAt = response.expiresAt ?? null;
      this.refreshToken = response.refreshToken ?? null;
      this.error = null;
      this.persistToStorage();
    },

    /**
     * Set user data (for profile updates)
     */
    setUser(user: User) {
      this.user = user;
      this.persistToStorage();
    },

    /**
     * Set authentication token manually (for SSO or external auth)
     */
    setToken(token: string, expiresAt?: string) {
      this.token = token;
      this.expiresAt = expiresAt ?? null;
      this.persistToStorage();
    },

    /**
     * Clear all authentication state
     */
    clearAuth() {
      this.user = null;
      this.token = null;
      this.expiresAt = null;
      this.refreshToken = null;
      this.error = null;
      this.clearStorage();
    },

    /**
     * Clear any error state
     */
    clearError() {
      this.error = null;
    },
  },
});

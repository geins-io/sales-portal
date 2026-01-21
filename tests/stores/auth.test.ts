import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../../app/stores/auth';
import { createMockLocalStorage } from '../utils';
import type { User, AuthResponse } from '../../shared/types';

// Track the mock implementation for $fetch
let mockFetchImpl: ReturnType<typeof vi.fn> = vi.fn();

// Mock ofetch at the module level before imports
vi.mock('#app/composables/fetch', () => ({
  $fetch: (...args: unknown[]) => mockFetchImpl(...args),
}));

// Also mock the global $fetch for direct usage
vi.stubGlobal('$fetch', (...args: unknown[]) => mockFetchImpl(...args));

describe('useAuthStore', () => {
  let mockLocalStorage: ReturnType<typeof createMockLocalStorage>;
  let originalLocalStorage: Storage;

  const mockUser: User = {
    id: '123',
    email: 'test@example.com',
    name: 'Test User',
    firstName: 'Test',
    lastName: 'User',
    roles: ['user'],
  };

  const mockAuthResponse: AuthResponse = {
    user: mockUser,
    token: 'mock-jwt-token',
    expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    refreshToken: 'mock-refresh-token',
  };

  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    setActivePinia(createPinia());

    // Save original localStorage
    originalLocalStorage = globalThis.localStorage;

    // Create and set mock localStorage
    mockLocalStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });

    // Reset mock fetch implementation
    mockFetchImpl = vi.fn();
    vi.stubGlobal('$fetch', (...args: unknown[]) => mockFetchImpl(...args));
  });

  afterEach(() => {
    // Restore original localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
    vi.unstubAllGlobals();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const store = useAuthStore();

      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(store.expiresAt).toBeNull();
      expect(store.refreshToken).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });
  });

  describe('isAuthenticated getter', () => {
    it('should return false when no token exists', () => {
      const store = useAuthStore();

      expect(store.isAuthenticated).toBe(false);
    });

    it('should return true when valid token exists', () => {
      const store = useAuthStore();
      store.token = 'valid-token';
      store.expiresAt = new Date(Date.now() + 3600000).toISOString();

      expect(store.isAuthenticated).toBe(true);
    });

    it('should return false when token is expired', () => {
      const store = useAuthStore();
      store.token = 'expired-token';
      store.expiresAt = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago

      expect(store.isAuthenticated).toBe(false);
    });

    it('should return true when token exists without expiration', () => {
      const store = useAuthStore();
      store.token = 'token-without-expiry';

      expect(store.isAuthenticated).toBe(true);
    });
  });

  describe('displayName getter', () => {
    it('should return null when no user exists', () => {
      const store = useAuthStore();

      expect(store.displayName).toBeNull();
    });

    it('should return user name when available', () => {
      const store = useAuthStore();
      store.user = { ...mockUser };

      expect(store.displayName).toBe('Test User');
    });

    it('should return first + last name when name is not available', () => {
      const store = useAuthStore();
      store.user = {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      expect(store.displayName).toBe('John Doe');
    });

    it('should return email when no name info available', () => {
      const store = useAuthStore();
      store.user = { id: '1', email: 'test@example.com' };

      expect(store.displayName).toBe('test@example.com');
    });
  });

  describe('userInitials getter', () => {
    it('should return null when no user exists', () => {
      const store = useAuthStore();

      expect(store.userInitials).toBeNull();
    });

    it('should return initials from first and last name', () => {
      const store = useAuthStore();
      store.user = { ...mockUser };

      expect(store.userInitials).toBe('TU');
    });

    it('should return initials from name', () => {
      const store = useAuthStore();
      store.user = { id: '1', email: 'test@example.com', name: 'John Smith' };

      expect(store.userInitials).toBe('JS');
    });

    it('should return single initial for single name', () => {
      const store = useAuthStore();
      store.user = { id: '1', email: 'test@example.com', name: 'John' };

      expect(store.userInitials).toBe('J');
    });

    it('should return email initial when no name available', () => {
      const store = useAuthStore();
      store.user = { id: '1', email: 'test@example.com' };

      expect(store.userInitials).toBe('T');
    });
  });

  describe('hasRole getter', () => {
    it('should return false when no user exists', () => {
      const store = useAuthStore();

      expect(store.hasRole('admin')).toBe(false);
    });

    it('should return true when user has the role', () => {
      const store = useAuthStore();
      store.user = { ...mockUser, roles: ['user', 'admin'] };

      expect(store.hasRole('admin')).toBe(true);
    });

    it('should return false when user does not have the role', () => {
      const store = useAuthStore();
      store.user = { ...mockUser, roles: ['user'] };

      expect(store.hasRole('admin')).toBe(false);
    });
  });

  describe('hasAnyRole getter', () => {
    it('should return false when no user exists', () => {
      const store = useAuthStore();

      expect(store.hasAnyRole(['admin', 'moderator'])).toBe(false);
    });

    it('should return true when user has any of the roles', () => {
      const store = useAuthStore();
      store.user = { ...mockUser, roles: ['user', 'moderator'] };

      expect(store.hasAnyRole(['admin', 'moderator'])).toBe(true);
    });

    it('should return false when user has none of the roles', () => {
      const store = useAuthStore();
      store.user = { ...mockUser, roles: ['user'] };

      expect(store.hasAnyRole(['admin', 'moderator'])).toBe(false);
    });
  });

  describe('setAuthFromResponse action', () => {
    it('should set auth state from response', () => {
      const store = useAuthStore();

      store.setAuthFromResponse(mockAuthResponse);

      expect(store.user).toEqual(mockUser);
      expect(store.token).toBe('mock-jwt-token');
      expect(store.expiresAt).toBe(mockAuthResponse.expiresAt);
      expect(store.refreshToken).toBe('mock-refresh-token');
      expect(store.error).toBeNull();
    });

    it('should persist to storage', () => {
      const store = useAuthStore();

      store.setAuthFromResponse(mockAuthResponse);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'auth_token',
        'mock-jwt-token',
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'auth_refresh_token',
        'mock-refresh-token',
      );
    });
  });

  describe('clearAuth action', () => {
    it('should clear all auth state', () => {
      const store = useAuthStore();
      store.setAuthFromResponse(mockAuthResponse);

      store.clearAuth();

      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(store.expiresAt).toBeNull();
      expect(store.refreshToken).toBeNull();
      expect(store.error).toBeNull();
    });

    it('should clear storage', () => {
      const store = useAuthStore();
      store.setAuthFromResponse(mockAuthResponse);

      store.clearAuth();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'auth_refresh_token',
      );
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_user');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'auth_expires_at',
      );
    });
  });

  describe('setUser action', () => {
    it('should update user and persist to storage', () => {
      const store = useAuthStore();
      const updatedUser: User = { ...mockUser, name: 'Updated Name' };

      store.setUser(updatedUser);

      expect(store.user).toEqual(updatedUser);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'auth_user',
        JSON.stringify(updatedUser),
      );
    });
  });

  describe('setToken action', () => {
    it('should set token and persist to storage', () => {
      const store = useAuthStore();
      const expiresAt = new Date(Date.now() + 3600000).toISOString();

      store.setToken('new-token', expiresAt);

      expect(store.token).toBe('new-token');
      expect(store.expiresAt).toBe(expiresAt);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'auth_token',
        'new-token',
      );
    });
  });

  describe('clearError action', () => {
    it('should clear error state', () => {
      const store = useAuthStore();
      store.error = 'Some error';

      store.clearError();

      expect(store.error).toBeNull();
    });
  });

  describe('initializeFromStorage action', () => {
    it('should restore auth state from storage', () => {
      const store = useAuthStore();

      // Set up stored values
      mockLocalStorage._store['auth_token'] = 'stored-token';
      mockLocalStorage._store['auth_refresh_token'] = 'stored-refresh-token';
      mockLocalStorage._store['auth_expires_at'] = new Date(
        Date.now() + 3600000,
      ).toISOString();
      mockLocalStorage._store['auth_user'] = JSON.stringify(mockUser);

      store.initializeFromStorage();

      expect(store.token).toBe('stored-token');
      expect(store.refreshToken).toBe('stored-refresh-token');
      expect(store.user).toEqual(mockUser);
    });

    it('should handle invalid user JSON gracefully', () => {
      const store = useAuthStore();

      mockLocalStorage._store['auth_token'] = 'stored-token';
      mockLocalStorage._store['auth_user'] = 'invalid-json';

      store.initializeFromStorage();

      expect(store.token).toBe('stored-token');
      expect(store.user).toBeNull();
    });
  });

  describe('login action', () => {
    it('should login successfully and set auth state', async () => {
      const store = useAuthStore();
      mockFetchImpl.mockResolvedValueOnce(mockAuthResponse);

      const result = await store.login({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result).toEqual(mockUser);
      expect(store.user).toEqual(mockUser);
      expect(store.token).toBe('mock-jwt-token');
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should set error on login failure', async () => {
      const store = useAuthStore();
      mockFetchImpl.mockRejectedValueOnce(new Error('Invalid credentials'));

      await expect(
        store.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow('Invalid credentials');

      expect(store.error).toBe('Invalid credentials');
      expect(store.isLoading).toBe(false);
    });

    it('should set loading state during login', async () => {
      const store = useAuthStore();
      mockFetchImpl.mockImplementation(
        () =>
          new Promise((resolve) => {
            // Check loading state while request is pending
            expect(store.isLoading).toBe(true);
            resolve(mockAuthResponse);
          }),
      );

      await store.login({ email: 'test@example.com', password: 'password' });

      expect(store.isLoading).toBe(false);
    });
  });

  describe('logout action', () => {
    it('should clear auth state on logout', async () => {
      const store = useAuthStore();
      store.setAuthFromResponse(mockAuthResponse);

      await store.logout();

      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(store.isLoading).toBe(false);
    });
  });

  describe('refreshAuthToken action', () => {
    it('should refresh token successfully', async () => {
      const store = useAuthStore();
      store.refreshToken = 'old-refresh-token';
      const newResponse = {
        ...mockAuthResponse,
        token: 'new-jwt-token',
        refreshToken: 'new-refresh-token',
      };
      mockFetchImpl.mockResolvedValueOnce(newResponse);

      const result = await store.refreshAuthToken();

      expect(result).toBe('new-jwt-token');
      expect(store.token).toBe('new-jwt-token');
      expect(store.refreshToken).toBe('new-refresh-token');
    });

    it('should throw error when no refresh token available', async () => {
      const store = useAuthStore();
      store.refreshToken = null;

      await expect(store.refreshAuthToken()).rejects.toThrow(
        'No refresh token available',
      );
    });

    it('should clear auth on refresh failure', async () => {
      const store = useAuthStore();
      store.setAuthFromResponse(mockAuthResponse);
      mockFetchImpl.mockRejectedValueOnce(new Error('Refresh failed'));

      await expect(store.refreshAuthToken()).rejects.toThrow('Refresh failed');
      expect(store.token).toBeNull();
      expect(store.user).toBeNull();
    });
  });
});

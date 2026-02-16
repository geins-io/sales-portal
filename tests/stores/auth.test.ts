import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../../app/stores/auth';
import type { AuthUser } from '@geins/types';

// Track the mock implementation for $fetch
let mockFetchImpl: ReturnType<typeof vi.fn> = vi.fn();

// Mock ofetch at the module level before imports
vi.mock('#app/composables/fetch', () => ({
  $fetch: (...args: unknown[]) => mockFetchImpl(...args),
}));

// Also mock the global $fetch for direct usage
vi.stubGlobal('$fetch', (...args: unknown[]) => mockFetchImpl(...args));

// Mock the logger
vi.mock('~/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('useAuthStore', () => {
  const mockUser: AuthUser = {
    authenticated: true,
    userId: '123',
    username: 'test@example.com',
    customerType: 'regular',
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    mockFetchImpl = vi.fn();
    vi.stubGlobal('$fetch', (...args: unknown[]) => mockFetchImpl(...args));
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const store = useAuthStore();

      expect(store.user).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.isInitialized).toBe(false);
      expect(store.error).toBeNull();
    });
  });

  describe('isAuthenticated getter', () => {
    it('should return false when no user exists', () => {
      const store = useAuthStore();

      expect(store.isAuthenticated).toBe(false);
    });

    it('should return true when user exists', () => {
      const store = useAuthStore();
      store.user = { ...mockUser };

      expect(store.isAuthenticated).toBe(true);
    });
  });

  describe('displayName getter', () => {
    it('should return null when no user exists', () => {
      const store = useAuthStore();

      expect(store.displayName).toBeNull();
    });

    it('should return username when available', () => {
      const store = useAuthStore();
      store.user = { ...mockUser, username: 'test@example.com' };

      expect(store.displayName).toBe('test@example.com');
    });

    it('should return null when username is not set', () => {
      const store = useAuthStore();
      store.user = { authenticated: true, userId: '1' };

      expect(store.displayName).toBeNull();
    });
  });

  describe('hasRole getter', () => {
    it('should return false when no user exists', () => {
      const store = useAuthStore();

      expect(store.hasRole('admin')).toBe(false);
    });

    it('should return true when user has the matching customerType', () => {
      const store = useAuthStore();
      store.user = { ...mockUser, customerType: 'admin' };

      expect(store.hasRole('admin')).toBe(true);
    });

    it('should return false when customerType does not match', () => {
      const store = useAuthStore();
      store.user = { ...mockUser, customerType: 'regular' };

      expect(store.hasRole('admin')).toBe(false);
    });
  });

  describe('hasAnyRole getter', () => {
    it('should return false when no user exists', () => {
      const store = useAuthStore();

      expect(store.hasAnyRole(['admin', 'premium'])).toBe(false);
    });

    it('should return true when customerType is in the list', () => {
      const store = useAuthStore();
      store.user = { ...mockUser, customerType: 'premium' };

      expect(store.hasAnyRole(['admin', 'premium'])).toBe(true);
    });

    it('should return false when customerType is not in the list', () => {
      const store = useAuthStore();
      store.user = { ...mockUser, customerType: 'regular' };

      expect(store.hasAnyRole(['admin', 'premium'])).toBe(false);
    });
  });

  describe('login action', () => {
    it('should login successfully and set user', async () => {
      const store = useAuthStore();
      mockFetchImpl.mockResolvedValueOnce({ user: mockUser });

      const result = await store.login({
        username: 'test@example.com',
        password: 'password',
      });

      expect(result).toEqual(mockUser);
      expect(store.user).toEqual(mockUser);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should call /api/auth/login with POST method', async () => {
      const store = useAuthStore();
      const creds = { username: 'test@example.com', password: 'pass' };
      mockFetchImpl.mockResolvedValueOnce({ user: mockUser });

      await store.login(creds);

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        body: creds,
      });
    });

    it('should set error on login failure with Error message', async () => {
      const store = useAuthStore();
      mockFetchImpl.mockRejectedValueOnce(new Error('Invalid credentials'));

      await expect(
        store.login({ username: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow('Invalid credentials');

      expect(store.error).toBe('Invalid credentials');
      expect(store.isLoading).toBe(false);
    });

    it('should use i18n key as fallback for non-Error failures', async () => {
      const store = useAuthStore();
      mockFetchImpl.mockRejectedValueOnce('not an Error object');

      await expect(
        store.login({ username: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow('auth.login_failed');

      expect(store.error).toBe('auth.login_failed');
    });

    it('should set loading state during login', async () => {
      const store = useAuthStore();
      mockFetchImpl.mockImplementation(
        () =>
          new Promise((resolve) => {
            expect(store.isLoading).toBe(true);
            resolve({ user: mockUser });
          }),
      );

      await store.login({ username: 'test@example.com', password: 'password' });

      expect(store.isLoading).toBe(false);
    });
  });

  describe('register action', () => {
    it('should register successfully and set user', async () => {
      const store = useAuthStore();
      mockFetchImpl.mockResolvedValueOnce({ user: mockUser });

      const result = await store.register({
        username: 'new@example.com',
        password: 'password',
      });

      expect(result).toEqual(mockUser);
      expect(store.user).toEqual(mockUser);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should call /api/auth/register with POST method', async () => {
      const store = useAuthStore();
      const creds = { username: 'new@example.com', password: 'pass' };
      mockFetchImpl.mockResolvedValueOnce({ user: mockUser });

      await store.register(creds);

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        body: creds,
      });
    });

    it('should set error on register failure with Error message', async () => {
      const store = useAuthStore();
      mockFetchImpl.mockRejectedValueOnce(new Error('Email already exists'));

      await expect(
        store.register({ username: 'dup@example.com', password: 'pass' }),
      ).rejects.toThrow('Email already exists');

      expect(store.error).toBe('Email already exists');
      expect(store.isLoading).toBe(false);
    });

    it('should use i18n key as fallback for non-Error failures', async () => {
      const store = useAuthStore();
      mockFetchImpl.mockRejectedValueOnce('not an Error object');

      await expect(
        store.register({ username: 'dup@example.com', password: 'pass' }),
      ).rejects.toThrow('auth.register_failed');

      expect(store.error).toBe('auth.register_failed');
    });
  });

  describe('logout action', () => {
    it('should clear user on logout', async () => {
      const store = useAuthStore();
      store.user = { ...mockUser };
      mockFetchImpl.mockResolvedValueOnce({});

      await store.logout();

      expect(store.user).toBeNull();
      expect(store.error).toBeNull();
      expect(store.isLoading).toBe(false);
    });

    it('should call /api/auth/logout with POST', async () => {
      const store = useAuthStore();
      mockFetchImpl.mockResolvedValueOnce({});

      await store.logout();

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
      });
    });

    it('should clear user even if API call fails', async () => {
      const store = useAuthStore();
      store.user = { ...mockUser };
      mockFetchImpl.mockRejectedValueOnce(new Error('Network error'));

      await store.logout();

      expect(store.user).toBeNull();
      expect(store.isLoading).toBe(false);
    });
  });

  describe('fetchUser action', () => {
    it('should fetch current user from /api/auth/me', async () => {
      const store = useAuthStore();
      mockFetchImpl.mockResolvedValueOnce({ user: mockUser });

      await store.fetchUser();

      expect(store.user).toEqual(mockUser);
      expect(store.isInitialized).toBe(true);
      expect(mockFetchImpl).toHaveBeenCalledWith('/api/auth/me');
    });

    it('should set user to null when no session', async () => {
      const store = useAuthStore();
      mockFetchImpl.mockResolvedValueOnce({ user: null });

      await store.fetchUser();

      expect(store.user).toBeNull();
      expect(store.isInitialized).toBe(true);
    });

    it('should set user to null on fetch error', async () => {
      const store = useAuthStore();
      mockFetchImpl.mockRejectedValueOnce(new Error('Network error'));

      await store.fetchUser();

      expect(store.user).toBeNull();
      expect(store.isInitialized).toBe(true);
    });

    it('should deduplicate concurrent fetchUser calls', async () => {
      const store = useAuthStore();
      let resolveCount = 0;
      mockFetchImpl.mockImplementation(() => {
        resolveCount++;
        return Promise.resolve({ user: mockUser });
      });

      // Call fetchUser three times concurrently
      await Promise.all([
        store.fetchUser(),
        store.fetchUser(),
        store.fetchUser(),
      ]);

      // Should only have made ONE $fetch call
      expect(resolveCount).toBe(1);
      expect(store.user).toEqual(mockUser);
      expect(store.isInitialized).toBe(true);
    });

    it('should allow a new fetchUser call after the first completes', async () => {
      const store = useAuthStore();
      mockFetchImpl.mockResolvedValue({ user: mockUser });

      await store.fetchUser();
      expect(mockFetchImpl).toHaveBeenCalledTimes(1);

      await store.fetchUser();
      expect(mockFetchImpl).toHaveBeenCalledTimes(2);
    });
  });

  describe('setUser action', () => {
    it('should set user directly', () => {
      const store = useAuthStore();

      store.setUser(mockUser);

      expect(store.user).toEqual(mockUser);
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
});

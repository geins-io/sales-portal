import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RouteLocationNormalized } from 'vue-router';

import authMiddleware from '../../app/middleware/auth';

let mockIsAuthenticated = false;
let mockIsInitialized = true;
let mockCustomerType: string | undefined = undefined;
const mockFetchUser = vi.fn();

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({
    get isAuthenticated() {
      return mockIsAuthenticated;
    },
    get isInitialized() {
      return mockIsInitialized;
    },
    get user() {
      return mockCustomerType ? { customerType: mockCustomerType } : null;
    },
    fetchUser: mockFetchUser,
    hasAnyRole: (roles: string[]) =>
      mockCustomerType ? roles.includes(mockCustomerType) : false,
  }),
}));

const mockNavigateTo = vi.fn((opts: { path: string }) => opts);

vi.mock('#app/composables/router', () => ({
  navigateTo: (...args: unknown[]) => mockNavigateTo(...args),
  defineNuxtRouteMiddleware: (fn: (to: RouteLocationNormalized) => unknown) =>
    fn,
}));

function createRoute(
  overrides: Partial<RouteLocationNormalized> = {},
): RouteLocationNormalized {
  return {
    path: '/portal',
    name: 'portal',
    params: {},
    query: {},
    hash: '',
    fullPath: '/portal',
    matched: [],
    redirectedFrom: undefined,
    meta: {},
    ...overrides,
  };
}

describe('auth middleware', () => {
  beforeEach(() => {
    mockIsAuthenticated = false;
    mockIsInitialized = true;
    mockCustomerType = undefined;
    mockFetchUser.mockReset();
    mockNavigateTo.mockClear();
  });

  it('redirects unauthenticated users to /login', async () => {
    const result = await authMiddleware(createRoute());
    expect(result).toEqual({
      path: '/login',
      query: { redirect: '/portal' },
    });
  });

  it('does not add redirect query for / path', async () => {
    const result = await authMiddleware(
      createRoute({ path: '/', fullPath: '/' }),
    );
    expect(result).toEqual({ path: '/login', query: undefined });
  });

  it('allows authenticated users through when no roles required', async () => {
    mockIsAuthenticated = true;
    mockCustomerType = 'retail';
    const result = await authMiddleware(createRoute());
    expect(result).toBeUndefined();
  });

  it('allows authenticated users with matching role', async () => {
    mockIsAuthenticated = true;
    mockCustomerType = 'wholesale';
    const result = await authMiddleware(
      createRoute({ meta: { roles: ['wholesale'] } }),
    );
    expect(result).toBeUndefined();
  });

  it('redirects authenticated users with wrong role to /', async () => {
    mockIsAuthenticated = true;
    mockCustomerType = 'retail';
    const result = await authMiddleware(
      createRoute({ meta: { roles: ['wholesale'] } }),
    );
    expect(result).toEqual({ path: '/' });
  });

  it('redirects authenticated users with no customerType when roles required', async () => {
    mockIsAuthenticated = true;
    mockCustomerType = undefined;
    const result = await authMiddleware(
      createRoute({ meta: { roles: ['wholesale'] } }),
    );
    expect(result).toEqual({ path: '/' });
  });

  it('calls fetchUser when not initialized', async () => {
    mockIsInitialized = false;
    await authMiddleware(createRoute());
    expect(mockFetchUser).toHaveBeenCalledOnce();
  });

  it('does not call fetchUser when already initialized', async () => {
    mockIsInitialized = true;
    await authMiddleware(createRoute());
    expect(mockFetchUser).not.toHaveBeenCalled();
  });
});

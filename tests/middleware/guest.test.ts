import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RouteLocationNormalized } from 'vue-router';

import guestMiddleware from '../../app/middleware/guest';

let mockIsAuthenticated = false;
let mockIsInitialized = true;
const mockFetchUser = vi.fn();

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({
    get isAuthenticated() {
      return mockIsAuthenticated;
    },
    get isInitialized() {
      return mockIsInitialized;
    },
    fetchUser: mockFetchUser,
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
    path: '/login',
    name: 'login',
    params: {},
    query: {},
    hash: '',
    fullPath: '/login',
    matched: [],
    redirectedFrom: undefined,
    meta: {},
    ...overrides,
  };
}

describe('guest middleware', () => {
  beforeEach(() => {
    mockIsAuthenticated = false;
    mockIsInitialized = true;
    mockFetchUser.mockReset();
    mockNavigateTo.mockClear();
  });

  it('allows unauthenticated users through', async () => {
    const result = await guestMiddleware(createRoute());
    expect(result).toBeUndefined();
  });

  it('redirects authenticated users to /', async () => {
    mockIsAuthenticated = true;
    const result = await guestMiddleware(createRoute());
    expect(result).toEqual({ path: '/' });
  });

  it('redirects authenticated users to redirect query param', async () => {
    mockIsAuthenticated = true;
    const result = await guestMiddleware(
      createRoute({
        fullPath: '/login?redirect=/portal',
        query: { redirect: '/portal' },
      }),
    );
    expect(result).toEqual({ path: '/portal' });
  });

  it('calls fetchUser when not initialized', async () => {
    mockIsInitialized = false;
    await guestMiddleware(createRoute());
    expect(mockFetchUser).toHaveBeenCalledOnce();
  });

  it('does not call fetchUser when already initialized', async () => {
    mockIsInitialized = true;
    await guestMiddleware(createRoute());
    expect(mockFetchUser).not.toHaveBeenCalled();
  });

  it('blocks open redirect to external URLs', async () => {
    mockIsAuthenticated = true;
    const result = await guestMiddleware(
      createRoute({ query: { redirect: '//evil.com' } }),
    );
    expect(result).toEqual({ path: '/' });
  });

  it('blocks open redirect with protocol', async () => {
    mockIsAuthenticated = true;
    const result = await guestMiddleware(
      createRoute({ query: { redirect: 'https://evil.com' } }),
    );
    expect(result).toEqual({ path: '/' });
  });
});

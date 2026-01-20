/**
 * Test Utilities and Helpers
 *
 * Common utilities for testing components, composables, and server functions.
 */

import { vi } from 'vitest';

/**
 * Create a mock Vue ref
 */
export function createMockRef<T>(value: T) {
  return {
    value,
  };
}

/**
 * Mock localStorage for tests
 */
export function createMockLocalStorage() {
  const store: Record<string, string> = {};

  const clearStore = () => {
    for (const key of Object.keys(store)) {
      store[key] = undefined as unknown as string;
      Reflect.deleteProperty(store, key);
    }
  };

  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      Reflect.deleteProperty(store, key);
    }),
    clear: vi.fn(() => {
      clearStore();
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    _store: store,
  };
}

/**
 * Mock sessionStorage for tests
 */
export function createMockSessionStorage() {
  return createMockLocalStorage();
}

/**
 * Wait for a specified amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock fetch response
 */
export function createMockFetchResponse<T>(data: T, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    headers: new Headers(),
  };
}

/**
 * Create a mock H3 event for server tests
 */
export function createMockH3Event(options: {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
}) {
  const { method = 'GET', path = '/', headers = {}, body, query = {} } = options;

  return {
    node: {
      req: {
        method,
        url: path,
        headers: {
          host: 'localhost:3000',
          ...headers,
        },
      },
      res: {
        statusCode: 200,
        setHeader: vi.fn(),
        end: vi.fn(),
      },
    },
    path,
    method,
    headers: new Headers(headers),
    context: {},
    _body: body,
    _query: query,
  };
}

/**
 * Create mock tenant configuration for tests
 */
export function createMockTenantConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-tenant',
    name: 'Test Tenant',
    hostname: 'test.example.com',
    isActive: true,
    settings: {
      language: 'en',
      currency: 'SEK',
      timezone: 'Europe/Stockholm',
    },
    theme: {
      name: 'test-theme',
      displayName: 'Test Theme',
      colors: {
        primary: { default: '#3b82f6' },
        secondary: { default: '#64748b' },
        background: { default: '#ffffff' },
      },
      borderRadius: {
        base: '0.5rem',
      },
    },
    features: {
      darkMode: true,
      search: true,
      authentication: true,
      cart: true,
    },
    ...overrides,
  };
}

/**
 * Flush all pending promises
 */
export async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Create a deferred promise for testing async behavior
 */
export function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Mock console methods for cleaner test output
 */
export function mockConsole() {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  const mocks = {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
  };

  return {
    mocks,
    restore: () => {
      Object.entries(originalConsole).forEach(([key, value]) => {
        (console as unknown as Record<string, typeof value>)[key] = value;
      });
    },
  };
}

/**
 * Generate a random string for test data
 */
export function randomString(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}

/**
 * Generate a mock UUID
 */
export function mockUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

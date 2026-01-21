import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '../utils';

// Create mock functions - these need to be hoisted
const mockApi = vi.fn();
const mockUseFetch = vi.fn();

// Mock the Nuxt auto-imports at the module level
vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args),
}));

vi.mock('#app', () => ({
  useNuxtApp: () => ({ $api: mockApi }),
  useFetch: (...args: unknown[]) => mockUseFetch(...args),
}));

// Stub globals for direct access
vi.stubGlobal('useFetch', (...args: unknown[]) => mockUseFetch(...args));
vi.stubGlobal('useNuxtApp', () => ({ $api: mockApi }));

// Create a mock AsyncData result similar to what useFetch returns
function createMockAsyncData<T>(data: T, autoResolve = true, error?: Error) {
  let resolvePromise: (value: T) => void;
  let rejectPromise: (reason: Error) => void;

  const internalPromise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const result = {
    data: { value: null as T | null },
    pending: { value: true },
    error: { value: null as Error | null },
    status: { value: 'pending' as 'pending' | 'success' | 'error' },
    refresh: vi.fn(),
    execute: vi.fn(),
    clear: vi.fn(),
    then: (
      onFulfilled?: (value: T) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => {
      return internalPromise
        .then((value) => {
          result.data.value = value;
          result.pending.value = false;
          result.status.value = 'success';
          return onFulfilled?.(value) ?? value;
        })
        .catch((reason) => {
          result.pending.value = false;
          result.error.value = reason as Error;
          result.status.value = 'error';
          if (onRejected) {
            return onRejected(reason);
          }
          throw reason;
        });
    },
    catch: (onRejected?: (reason: unknown) => unknown) => {
      return internalPromise.catch((reason) => {
        result.pending.value = false;
        result.error.value = reason as Error;
        result.status.value = 'error';
        return onRejected?.(reason);
      });
    },
  };

  // Auto-resolve or reject after a microtask
  if (autoResolve) {
    Promise.resolve().then(() => {
      if (error) {
        rejectPromise!(error);
      } else {
        resolvePromise!(data);
      }
    });
  }

  return result;
}

describe('useApi', () => {
  let useApi: typeof import('../../app/composables/useApi').useApi;
  let clearPendingRequests: typeof import('../../app/composables/useApi').clearPendingRequests;
  let getPendingRequestsCount: typeof import('../../app/composables/useApi').getPendingRequestsCount;

  beforeEach(async () => {
    // Clear mock call history
    mockUseFetch.mockClear();
    mockApi.mockClear();

    // Reset the module to clear the pendingRequests Map
    vi.resetModules();

    // Re-stub globals after module reset
    vi.stubGlobal('useFetch', (...args: unknown[]) => mockUseFetch(...args));
    vi.stubGlobal('useNuxtApp', () => ({ $api: mockApi }));

    // Re-import after reset to get fresh state
    const module = await import('../../app/composables/useApi');
    useApi = module.useApi;
    clearPendingRequests = module.clearPendingRequests;
    getPendingRequestsCount = module.getPendingRequestsCount;
  });

  afterEach(() => {
    clearPendingRequests?.();
  });

  describe('basic functionality', () => {
    it('should call useFetch with the correct parameters', () => {
      const mockResult = createMockAsyncData({ data: 'test' });
      mockUseFetch.mockReturnValue(mockResult);

      useApi('/api/test', { method: 'GET' });

      expect(mockUseFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockUseFetch.mock.calls[0];
      expect(url).toBe('/api/test');
      expect(options.method).toBe('GET');
      expect(options.$fetch).toBeDefined();
    });

    it('should return the useFetch result', () => {
      const mockResult = createMockAsyncData({ data: 'test' });
      mockUseFetch.mockReturnValue(mockResult);

      const result = useApi('/api/test');

      expect(result).toBe(mockResult);
    });

    it('should handle URL as a function', () => {
      const mockResult = createMockAsyncData({ data: 'test' });
      mockUseFetch.mockReturnValue(mockResult);

      const urlFn = () => '/api/dynamic';
      useApi(urlFn);

      expect(mockUseFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockUseFetch.mock.calls[0];
      expect(url).toBe(urlFn);
      expect(options.$fetch).toBeDefined();
    });
  });

  describe('request deduplication', () => {
    it('should return the same request for identical simultaneous calls', () => {
      const mockResult = createMockAsyncData({ data: 'test' }, false);
      mockUseFetch.mockReturnValue(mockResult);

      const result1 = useApi('/api/test');
      const result2 = useApi('/api/test');

      expect(result1).toBe(result2);
      expect(mockUseFetch).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate requests with the same URL and options', () => {
      const mockResult = createMockAsyncData({ data: 'test' }, false);
      mockUseFetch.mockReturnValue(mockResult);

      const options = {
        method: 'GET' as const,
        headers: { 'X-Custom': 'value' },
      };

      const result1 = useApi('/api/test', options);
      const result2 = useApi('/api/test', options);

      expect(result1).toBe(result2);
      expect(mockUseFetch).toHaveBeenCalledTimes(1);
    });

    it('should create separate requests for different URLs', () => {
      const mockResult1 = createMockAsyncData({ data: 'test1' }, false);
      const mockResult2 = createMockAsyncData({ data: 'test2' }, false);
      mockUseFetch
        .mockReturnValueOnce(mockResult1)
        .mockReturnValueOnce(mockResult2);

      const result1 = useApi('/api/test1');
      const result2 = useApi('/api/test2');

      expect(result1).not.toBe(result2);
      expect(mockUseFetch).toHaveBeenCalledTimes(2);
    });

    it('should create separate requests for different options', () => {
      const mockResult1 = createMockAsyncData({ data: 'test1' }, false);
      const mockResult2 = createMockAsyncData({ data: 'test2' }, false);
      mockUseFetch
        .mockReturnValueOnce(mockResult1)
        .mockReturnValueOnce(mockResult2);

      const result1 = useApi('/api/test', { method: 'GET' });
      const result2 = useApi('/api/test', { method: 'POST' });

      expect(result1).not.toBe(result2);
      expect(mockUseFetch).toHaveBeenCalledTimes(2);
    });

    it('should create separate requests for different query parameters', () => {
      const mockResult1 = createMockAsyncData({ data: 'test1' }, false);
      const mockResult2 = createMockAsyncData({ data: 'test2' }, false);
      mockUseFetch
        .mockReturnValueOnce(mockResult1)
        .mockReturnValueOnce(mockResult2);

      const result1 = useApi('/api/test', { query: { page: 1 } });
      const result2 = useApi('/api/test', { query: { page: 2 } });

      expect(result1).not.toBe(result2);
      expect(mockUseFetch).toHaveBeenCalledTimes(2);
    });

    it('should remove completed requests from the pending map', async () => {
      const mockResult = createMockAsyncData({ data: 'test' }, true);
      mockUseFetch.mockReturnValue(mockResult);

      useApi('/api/test');
      expect(getPendingRequestsCount()).toBe(1);

      // Wait for the promise to resolve and cleanup to run
      await flushPromises();
      await flushPromises();

      expect(getPendingRequestsCount()).toBe(0);
    });

    it('should remove failed requests from the pending map', async () => {
      const error = new Error('Request failed');
      const mockResult = createMockAsyncData(null, true, error);
      mockUseFetch.mockReturnValue(mockResult);

      useApi('/api/test');
      expect(getPendingRequestsCount()).toBe(1);

      // Wait for the promise to reject and cleanup to run
      await flushPromises();
      await flushPromises();

      expect(getPendingRequestsCount()).toBe(0);
    });

    it('should allow new request after previous one completes', async () => {
      const mockResult1 = createMockAsyncData({ data: 'test1' }, true);
      mockUseFetch.mockReturnValue(mockResult1);

      const result1 = useApi('/api/test');

      // Wait for the first request to complete
      await flushPromises();
      await flushPromises();

      const mockResult2 = createMockAsyncData({ data: 'test2' }, false);
      mockUseFetch.mockReturnValue(mockResult2);

      const result2 = useApi('/api/test');

      expect(result1).not.toBe(result2);
      expect(mockUseFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('key generation', () => {
    it('should generate the same key for requests with identical options', () => {
      const mockResult = createMockAsyncData({ data: 'test' }, false);
      mockUseFetch.mockReturnValue(mockResult);

      // Two calls with equivalent options (same values, different object references)
      const result1 = useApi('/api/test', {
        method: 'GET',
        headers: { 'X-Test': 'value' },
      });
      const result2 = useApi('/api/test', {
        method: 'GET',
        headers: { 'X-Test': 'value' },
      });

      expect(result1).toBe(result2);
      expect(mockUseFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle options with callback functions', () => {
      const mockResult = createMockAsyncData({ data: 'test' }, false);
      mockUseFetch.mockReturnValue(mockResult);

      // Callbacks should be normalized in the key
      const result1 = useApi('/api/test', {
        onRequest: () => {},
        onResponse: () => {},
      });
      const result2 = useApi('/api/test', {
        onRequest: () => {},
        onResponse: () => {},
      });

      // Should be deduplicated because callbacks are normalized
      expect(result1).toBe(result2);
      expect(mockUseFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle function URLs with same function reference', () => {
      const mockResult = createMockAsyncData({ data: 'test' }, false);
      mockUseFetch.mockReturnValue(mockResult);

      const urlFn = () => '/api/dynamic';

      const result1 = useApi(urlFn);
      const result2 = useApi(urlFn);

      expect(result1).toBe(result2);
      expect(mockUseFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('helper functions', () => {
    it('clearPendingRequests should clear all pending requests', () => {
      const mockResult1 = createMockAsyncData({ data: 'test' }, false);
      const mockResult2 = createMockAsyncData({ data: 'test' }, false);
      mockUseFetch
        .mockReturnValueOnce(mockResult1)
        .mockReturnValueOnce(mockResult2);

      useApi('/api/test1');
      useApi('/api/test2');

      expect(getPendingRequestsCount()).toBe(2);

      clearPendingRequests();

      expect(getPendingRequestsCount()).toBe(0);
    });

    it('getPendingRequestsCount should return correct count', () => {
      expect(getPendingRequestsCount()).toBe(0);

      const mockResult1 = createMockAsyncData({ data: 'test' }, false);
      const mockResult2 = createMockAsyncData({ data: 'test' }, false);
      mockUseFetch
        .mockReturnValueOnce(mockResult1)
        .mockReturnValueOnce(mockResult2);

      useApi('/api/test1');
      expect(getPendingRequestsCount()).toBe(1);

      useApi('/api/test2');
      expect(getPendingRequestsCount()).toBe(2);
    });
  });
});

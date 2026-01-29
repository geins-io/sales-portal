import { describe, it, expect, vi, beforeEach } from 'vitest';

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
function createMockAsyncData<T>(data: T) {
  const result = {
    data: { value: data },
    pending: { value: false },
    error: { value: null as Error | null },
    status: { value: 'success' as const },
    refresh: vi.fn(),
    execute: vi.fn(),
    clear: vi.fn(),
  };

  return result;
}

describe('useApi', () => {
  let useApi: typeof import('../../app/composables/useApi').useApi;

  beforeEach(async () => {
    // Clear mock call history
    mockUseFetch.mockClear();
    mockApi.mockClear();

    // Reset the module to get fresh state
    vi.resetModules();

    // Re-stub globals after module reset
    vi.stubGlobal('useFetch', (...args: unknown[]) => mockUseFetch(...args));
    vi.stubGlobal('useNuxtApp', () => ({ $api: mockApi }));

    // Re-import after reset
    const module = await import('../../app/composables/useApi');
    useApi = module.useApi;
  });

  describe('basic functionality', () => {
    it('should call useFetch with the correct URL', () => {
      const mockResult = createMockAsyncData({ data: 'test' });
      mockUseFetch.mockReturnValue(mockResult);

      useApi('/api/test');

      expect(mockUseFetch).toHaveBeenCalledTimes(1);
      const [url] = mockUseFetch.mock.calls[0];
      expect(url).toBe('/api/test');
    });

    it('should pass the $api instance to useFetch', () => {
      const mockResult = createMockAsyncData({ data: 'test' });
      mockUseFetch.mockReturnValue(mockResult);

      useApi('/api/test');

      const [, options] = mockUseFetch.mock.calls[0];
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
      const [url] = mockUseFetch.mock.calls[0];
      expect(url).toBe(urlFn);
    });
  });

  describe('dedupe option', () => {
    it('should set dedupe to "defer" by default for built-in deduplication', () => {
      const mockResult = createMockAsyncData({ data: 'test' });
      mockUseFetch.mockReturnValue(mockResult);

      useApi('/api/test');

      const [, options] = mockUseFetch.mock.calls[0];
      expect(options.dedupe).toBe('defer');
    });

    it('should allow overriding dedupe option', () => {
      const mockResult = createMockAsyncData({ data: 'test' });
      mockUseFetch.mockReturnValue(mockResult);

      useApi('/api/test', { dedupe: 'cancel' });

      const [, options] = mockUseFetch.mock.calls[0];
      expect(options.dedupe).toBe('cancel');
    });
  });

  describe('options passthrough', () => {
    it('should pass custom method to useFetch', () => {
      const mockResult = createMockAsyncData({ data: 'test' });
      mockUseFetch.mockReturnValue(mockResult);

      useApi('/api/test', { method: 'POST' });

      const [, options] = mockUseFetch.mock.calls[0];
      expect(options.method).toBe('POST');
    });

    it('should pass query parameters to useFetch', () => {
      const mockResult = createMockAsyncData({ data: 'test' });
      mockUseFetch.mockReturnValue(mockResult);

      useApi('/api/test', { query: { page: 1, limit: 10 } });

      const [, options] = mockUseFetch.mock.calls[0];
      expect(options.query).toEqual({ page: 1, limit: 10 });
    });

    it('should pass headers to useFetch', () => {
      const mockResult = createMockAsyncData({ data: 'test' });
      mockUseFetch.mockReturnValue(mockResult);

      useApi('/api/test', { headers: { 'X-Custom': 'value' } });

      const [, options] = mockUseFetch.mock.calls[0];
      expect(options.headers).toEqual({ 'X-Custom': 'value' });
    });

    it('should pass body to useFetch', () => {
      const mockResult = createMockAsyncData({ data: 'test' });
      mockUseFetch.mockReturnValue(mockResult);

      const body = { name: 'test', value: 123 };
      useApi('/api/test', { method: 'POST', body });

      const [, options] = mockUseFetch.mock.calls[0];
      expect(options.body).toEqual(body);
    });

    it('should pass callback options to useFetch', () => {
      const mockResult = createMockAsyncData({ data: 'test' });
      mockUseFetch.mockReturnValue(mockResult);

      const onRequest = vi.fn();
      const onResponse = vi.fn();
      useApi('/api/test', { onRequest, onResponse });

      const [, options] = mockUseFetch.mock.calls[0];
      expect(options.onRequest).toBe(onRequest);
      expect(options.onResponse).toBe(onResponse);
    });
  });

  describe('multiple requests', () => {
    it('should create separate requests for different URLs', () => {
      const mockResult1 = createMockAsyncData({ data: 'test1' });
      const mockResult2 = createMockAsyncData({ data: 'test2' });
      mockUseFetch
        .mockReturnValueOnce(mockResult1)
        .mockReturnValueOnce(mockResult2);

      const result1 = useApi('/api/test1');
      const result2 = useApi('/api/test2');

      expect(result1).not.toBe(result2);
      expect(mockUseFetch).toHaveBeenCalledTimes(2);
    });

    it('should create separate requests for different options', () => {
      const mockResult1 = createMockAsyncData({ data: 'test1' });
      const mockResult2 = createMockAsyncData({ data: 'test2' });
      mockUseFetch
        .mockReturnValueOnce(mockResult1)
        .mockReturnValueOnce(mockResult2);

      const result1 = useApi('/api/test', { method: 'GET' });
      const result2 = useApi('/api/test', { method: 'POST' });

      expect(result1).not.toBe(result2);
      expect(mockUseFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('memory management (SAL-75)', () => {
    it('should delegate deduplication to Nuxt useFetch via dedupe option', () => {
      // The implementation should NOT maintain its own pendingRequests Map
      // Instead, it delegates to Nuxt's built-in dedupe mechanism
      const mockResult = createMockAsyncData({ data: 'test' });
      mockUseFetch.mockReturnValue(mockResult);

      useApi('/api/test');

      // Verify that dedupe option is passed to useFetch
      const [, options] = mockUseFetch.mock.calls[0];
      expect(options.dedupe).toBe('defer');

      // The composable should not expose pendingRequests management functions
      // (clearPendingRequests and getPendingRequestsCount were removed)
    });

    it('should not maintain internal request tracking state', async () => {
      // Import the module and verify no exported state management functions
      const module = await import('../../app/composables/useApi');

      // Verify that old memory-leaking functions are not exported
      expect(module).not.toHaveProperty('clearPendingRequests');
      expect(module).not.toHaveProperty('getPendingRequestsCount');
      expect(module).not.toHaveProperty('pendingRequests');

      // Only useApi should be exported
      expect(Object.keys(module)).toEqual(['useApi']);
    });

    it('should use Nuxt lifecycle-aware deduplication', () => {
      // Nuxt's useFetch with dedupe option handles:
      // - Automatic cleanup on component unmount
      // - Request cancellation cleanup
      // - SSR memory isolation
      const mockResult = createMockAsyncData({ data: 'test' });
      mockUseFetch.mockReturnValue(mockResult);

      useApi('/api/test');

      // The dedupe: 'defer' option tells Nuxt to return existing pending request
      // for duplicate calls, while automatically managing the lifecycle
      const [, options] = mockUseFetch.mock.calls[0];
      expect(options.dedupe).toBe('defer');
    });

    it('should allow dedupe cancellation strategy when specified', () => {
      // When dedupe: 'cancel' is used, Nuxt cancels previous pending requests
      // This provides proper abort cleanup without memory leaks
      const mockResult = createMockAsyncData({ data: 'test' });
      mockUseFetch.mockReturnValue(mockResult);

      useApi('/api/test', { dedupe: 'cancel' });

      const [, options] = mockUseFetch.mock.calls[0];
      expect(options.dedupe).toBe('cancel');
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createApiClient,
  mergeHeaders,
  getErrorMessage,
  isTimeoutError,
  isHttpError,
  DEFAULT_API_CLIENT_CONFIG,
  type ApiClientConfig,
} from '../../app/utils/api-client';

// Mock $fetch.create
const mockFetchCreate = vi.fn();
const mockFetch = vi.fn();

vi.stubGlobal('$fetch', Object.assign(mockFetch, { create: mockFetchCreate }));

describe('api-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchCreate.mockReturnValue(mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createApiClient', () => {
    it('should create a fetch instance with default configuration', () => {
      createApiClient();

      expect(mockFetchCreate).toHaveBeenCalledTimes(1);
      const config = mockFetchCreate.mock.calls[0][0];

      expect(config.baseURL).toBeUndefined();
      expect(config.timeout).toBe(DEFAULT_API_CLIENT_CONFIG.timeout);
      expect(config.credentials).toBe(DEFAULT_API_CLIENT_CONFIG.credentials);
    });

    it('should create a fetch instance with custom configuration', () => {
      const customConfig: ApiClientConfig = {
        baseUrl: 'https://api.example.com',
        retry: 5,
        retryDelay: 2000,
        timeout: 60000,
        credentials: 'include',
        headers: { 'X-Custom': 'value' },
      };

      createApiClient(customConfig);

      expect(mockFetchCreate).toHaveBeenCalledTimes(1);
      const config = mockFetchCreate.mock.calls[0][0];

      expect(config.baseURL).toBe('https://api.example.com');
      expect(config.timeout).toBe(60000);
      expect(config.credentials).toBe('include');
      expect(config.headers).toEqual({ 'X-Custom': 'value' });
    });

    it('should register onRequest interceptor', async () => {
      const onRequest = vi.fn();
      createApiClient({ onRequest });

      const config = mockFetchCreate.mock.calls[0][0];
      const context = { options: {} };

      await config.onRequest(context);

      expect(onRequest).toHaveBeenCalledWith(context);
    });

    it('should register onResponse interceptor', async () => {
      const onResponse = vi.fn();
      createApiClient({ onResponse });

      const config = mockFetchCreate.mock.calls[0][0];
      const context = { response: { status: 200 } };

      await config.onResponse(context);

      expect(onResponse).toHaveBeenCalledWith(context);
    });

    it('should register onRequestError interceptor', async () => {
      const onRequestError = vi.fn();
      createApiClient({ onRequestError, retry: 0 });

      const config = mockFetchCreate.mock.calls[0][0];
      const context = {
        request: '/test',
        options: { method: 'POST' },
        error: new Error('Network error'),
      };

      await config.onRequestError(context);

      expect(onRequestError).toHaveBeenCalledWith(context);
    });

    it('should register onResponseError interceptor', async () => {
      const onResponseError = vi.fn();
      createApiClient({ onResponseError, retry: 0 });

      const config = mockFetchCreate.mock.calls[0][0];
      const context = {
        request: '/test',
        options: { method: 'POST' },
        response: { status: 500, statusText: 'Internal Server Error' },
      };

      await config.onResponseError(context);

      expect(onResponseError).toHaveBeenCalledWith(context);
    });

    it('should initialize retry count on first request', async () => {
      createApiClient();

      const config = mockFetchCreate.mock.calls[0][0];
      const options: Record<string, unknown> = {};
      const context = { options };

      await config.onRequest(context);

      expect(options._retryCount).toBe(0);
    });

    it('should preserve existing retry count', async () => {
      createApiClient();

      const config = mockFetchCreate.mock.calls[0][0];
      const options = { _retryCount: 2 };
      const context = { options };

      await config.onRequest(context);

      expect(options._retryCount).toBe(2);
    });
  });

  describe('DEFAULT_API_CLIENT_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_API_CLIENT_CONFIG.retry).toBe(3);
      expect(DEFAULT_API_CLIENT_CONFIG.retryDelay).toBe(1000);
      expect(DEFAULT_API_CLIENT_CONFIG.maxRetryDelay).toBe(30000);
      expect(DEFAULT_API_CLIENT_CONFIG.timeout).toBe(30000);
      expect(DEFAULT_API_CLIENT_CONFIG.credentials).toBe('same-origin');
    });
  });

  describe('mergeHeaders', () => {
    it('should merge object headers', () => {
      const result = mergeHeaders(
        { 'Content-Type': 'application/json' },
        { Authorization: 'Bearer token' },
      );

      expect(result).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer token',
      });
    });

    it('should handle undefined sources', () => {
      const result = mergeHeaders(
        undefined,
        { 'Content-Type': 'application/json' },
        undefined,
      );

      expect(result).toEqual({ 'Content-Type': 'application/json' });
    });

    it('should override earlier values with later values', () => {
      const result = mergeHeaders(
        { 'Content-Type': 'text/plain' },
        { 'Content-Type': 'application/json' },
      );

      expect(result).toEqual({ 'Content-Type': 'application/json' });
    });

    it('should handle Headers instance', () => {
      const headers = new Headers();
      headers.set('Content-Type', 'application/json');
      headers.set('Authorization', 'Bearer token');

      const result = mergeHeaders(headers);

      // Headers API may preserve or lowercase keys depending on environment
      // Check values case-insensitively
      const normalizedResult = Object.fromEntries(
        Object.entries(result).map(([k, v]) => [k.toLowerCase(), v]),
      );
      expect(normalizedResult).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer token',
      });
    });

    it('should handle array of header tuples', () => {
      const result = mergeHeaders([
        ['Content-Type', 'application/json'],
        ['Authorization', 'Bearer token'],
      ]);

      expect(result).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer token',
      });
    });

    it('should merge mixed header types', () => {
      const headers = new Headers();
      headers.set('X-Request-Id', '123');

      const result = mergeHeaders(
        headers,
        { 'Content-Type': 'application/json' },
        [['Authorization', 'Bearer token']],
      );

      // Headers API may preserve or lowercase keys depending on environment
      // Normalize keys for comparison
      const normalizedResult = Object.fromEntries(
        Object.entries(result).map(([k, v]) => [k.toLowerCase(), v]),
      );
      expect(normalizedResult).toEqual({
        'x-request-id': '123',
        'content-type': 'application/json',
        authorization: 'Bearer token',
      });
    });

    it('should return empty object for no sources', () => {
      const result = mergeHeaders();
      expect(result).toEqual({});
    });
  });

  describe('getErrorMessage', () => {
    it('should extract message from Error instance', () => {
      const error = new Error('Something went wrong');
      expect(getErrorMessage(error)).toBe('Something went wrong');
    });

    it('should return string directly', () => {
      expect(getErrorMessage('Direct error message')).toBe(
        'Direct error message',
      );
    });

    it('should extract message from object with message property', () => {
      const error = { message: 'Object error message' };
      expect(getErrorMessage(error)).toBe('Object error message');
    });

    it('should return default message for unknown types', () => {
      expect(getErrorMessage(null)).toBe('An unknown error occurred');
      expect(getErrorMessage(undefined)).toBe('An unknown error occurred');
      expect(getErrorMessage(123)).toBe('An unknown error occurred');
      expect(getErrorMessage({})).toBe('An unknown error occurred');
    });

    it('should handle object with non-string message', () => {
      const error = { message: 123 };
      expect(getErrorMessage(error)).toBe('An unknown error occurred');
    });
  });

  describe('isTimeoutError', () => {
    it('should return true for AbortError', () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      expect(isTimeoutError(error)).toBe(true);
    });

    it('should return true for timeout message', () => {
      const error = new Error('Request timeout exceeded');
      expect(isTimeoutError(error)).toBe(true);
    });

    it('should return true for TIMEOUT message (case insensitive)', () => {
      const error = new Error('TIMEOUT ERROR');
      expect(isTimeoutError(error)).toBe(true);
    });

    it('should return false for non-timeout errors', () => {
      const error = new Error('Network error');
      expect(isTimeoutError(error)).toBe(false);
    });

    it('should return false for non-Error values', () => {
      expect(isTimeoutError(null)).toBe(false);
      expect(isTimeoutError('timeout')).toBe(false);
      expect(isTimeoutError({ name: 'AbortError' })).toBe(false);
    });
  });

  describe('isHttpError', () => {
    it('should return true for error with statusCode', () => {
      const error = Object.assign(new Error('Not Found'), { statusCode: 404 });
      expect(isHttpError(error)).toBe(true);
    });

    it('should match specific status code', () => {
      const error = Object.assign(new Error('Not Found'), { statusCode: 404 });
      expect(isHttpError(error, 404)).toBe(true);
      expect(isHttpError(error, 500)).toBe(false);
    });

    it('should return false for error without statusCode', () => {
      const error = new Error('Some error');
      expect(isHttpError(error)).toBe(false);
    });

    it('should return false for non-Error values', () => {
      expect(isHttpError(null)).toBe(false);
      expect(isHttpError({ statusCode: 404 })).toBe(false);
      expect(isHttpError('error')).toBe(false);
    });
  });

  describe('retry logic integration', () => {
    it('should not retry POST requests by default', async () => {
      createApiClient({ retry: 3 });

      const config = mockFetchCreate.mock.calls[0][0];
      const context = {
        request: '/test',
        options: { method: 'POST', _retryCount: 0 },
        response: { status: 500, statusText: 'Internal Server Error' },
      };

      // Should not throw (which would indicate a retry attempt)
      await config.onResponseError(context);

      // Verify no retry was attempted (mockFetch not called)
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should allow custom shouldRetry logic', async () => {
      const customShouldRetry = vi.fn().mockReturnValue(false);
      createApiClient({
        retry: 3,
        shouldRetry: customShouldRetry,
      });

      const config = mockFetchCreate.mock.calls[0][0];
      const context = {
        request: '/test',
        options: { method: 'GET', _retryCount: 0 },
        response: { status: 500, statusText: 'Internal Server Error' },
      };

      await config.onResponseError(context);

      expect(customShouldRetry).toHaveBeenCalledWith(expect.any(Error), {
        attempt: 0,
        method: 'GET',
        statusCode: 500,
      });
    });

    it('should not retry when max retries exceeded', async () => {
      createApiClient({ retry: 3 });

      const config = mockFetchCreate.mock.calls[0][0];
      const context = {
        request: '/test',
        options: { method: 'GET', _retryCount: 3 },
        response: { status: 500, statusText: 'Internal Server Error' },
      };

      await config.onResponseError(context);

      // Verify no retry was attempted
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not retry 4xx errors except specific codes', async () => {
      createApiClient({ retry: 3 });

      const config = mockFetchCreate.mock.calls[0][0];

      // Test 400 Bad Request - should not retry
      const context400 = {
        request: '/test',
        options: { method: 'GET', _retryCount: 0 },
        response: { status: 400, statusText: 'Bad Request' },
      };

      await config.onResponseError(context400);
      expect(mockFetch).not.toHaveBeenCalled();

      // Test 404 Not Found - should not retry
      const context404 = {
        request: '/test',
        options: { method: 'GET', _retryCount: 0 },
        response: { status: 404, statusText: 'Not Found' },
      };

      await config.onResponseError(context404);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle missing response in onResponseError', async () => {
      createApiClient({ retry: 3 });

      const config = mockFetchCreate.mock.calls[0][0];
      const context = {
        request: '/test',
        options: { method: 'GET', _retryCount: 0 },
        response: undefined,
      };

      // Should not throw
      await config.onResponseError(context);
    });

    it('should handle missing method in options (defaults to GET)', async () => {
      // Disable retry for this test to avoid recursive $fetch call
      createApiClient({ retry: 0 });

      const config = mockFetchCreate.mock.calls[0][0];
      const context = {
        request: '/test',
        options: { _retryCount: 0 },
        response: { status: 500, statusText: 'Internal Server Error' },
      };

      // Should treat as GET (idempotent) - verifies no error is thrown
      // Retry is disabled so it won't attempt a recursive call
      await config.onResponseError(context);
    });

    it('should call user callbacks even when retry is disabled', async () => {
      const onResponseError = vi.fn();
      createApiClient({ retry: 0, onResponseError });

      const config = mockFetchCreate.mock.calls[0][0];
      const context = {
        request: '/test',
        options: { method: 'GET', _retryCount: 0 },
        response: { status: 500, statusText: 'Internal Server Error' },
      };

      await config.onResponseError(context);

      expect(onResponseError).toHaveBeenCalledWith(context);
    });
  });
});

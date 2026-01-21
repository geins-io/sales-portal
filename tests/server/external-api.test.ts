import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { H3Event } from 'h3';
import { createExternalApiError } from '../../server/utils/errors';

// Create mock functions for h3 utilities
const mockSendProxy = vi.fn();
const mockReadRawBody = vi.fn();

// Mock the errors module
vi.mock('../../server/utils/errors', () => ({
  createExternalApiError: vi.fn((service: string, error?: Error) => {
    const h3Error = new Error(
      error?.message || `Error communicating with ${service}`,
    ) as Error & { statusCode: number; data: Record<string, unknown> };
    h3Error.statusCode = 502;
    h3Error.data = {
      code: 'EXTERNAL_API_ERROR',
      details: {
        service,
        originalMessage: error?.message,
      },
    };
    return h3Error;
  }),
}));

// Stub all Nuxt auto-imported globals
vi.stubGlobal(
  'defineEventHandler',
  (handler: (event: H3Event) => unknown) => handler,
);
vi.stubGlobal('sendProxy', (...args: unknown[]) => mockSendProxy(...args));
vi.stubGlobal('readRawBody', (...args: unknown[]) => mockReadRawBody(...args));

describe('External API Proxy', () => {
  let handler: (event: H3Event) => Promise<unknown>;

  const createMockEvent = (
    overrides: Partial<{
      path: string;
      method: string;
      tenantId: string;
    }> = {},
  ): H3Event => {
    return {
      path: overrides.path || '/api/external/products',
      method: overrides.method || 'GET',
      context: {
        tenant: {
          id: overrides.tenantId || 'test-tenant',
        },
      },
    } as unknown as H3Event;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSendProxy.mockResolvedValue({ status: 200 });
    mockReadRawBody.mockResolvedValue('{"data": "test"}');

    // Clear module cache and reimport
    vi.resetModules();
    const module = await import('../../server/api/external/[...].ts');
    handler = module.default as (event: H3Event) => Promise<unknown>;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Successful requests', () => {
    it('should proxy GET requests to external API', async () => {
      const event = createMockEvent({
        path: '/api/external/products',
        method: 'GET',
      });

      await handler(event);

      expect(mockSendProxy).toHaveBeenCalledWith(
        event,
        'https://api.app.com/test-tenant/products',
        expect.objectContaining({
          fetchOptions: expect.objectContaining({
            method: 'GET',
            body: undefined,
            signal: expect.any(AbortSignal),
          }),
        }),
      );
    });

    it('should proxy POST requests with body', async () => {
      const event = createMockEvent({
        path: '/api/external/orders',
        method: 'POST',
      });

      await handler(event);

      expect(mockReadRawBody).toHaveBeenCalledWith(event);
      expect(mockSendProxy).toHaveBeenCalledWith(
        event,
        'https://api.app.com/test-tenant/orders',
        expect.objectContaining({
          fetchOptions: expect.objectContaining({
            method: 'POST',
            body: '{"data": "test"}',
            signal: expect.any(AbortSignal),
          }),
        }),
      );
    });

    it('should proxy PUT requests with body', async () => {
      const event = createMockEvent({
        path: '/api/external/products/123',
        method: 'PUT',
      });

      await handler(event);

      expect(mockReadRawBody).toHaveBeenCalledWith(event);
      expect(mockSendProxy).toHaveBeenCalledWith(
        event,
        'https://api.app.com/test-tenant/products/123',
        expect.objectContaining({
          fetchOptions: expect.objectContaining({
            method: 'PUT',
            body: '{"data": "test"}',
          }),
        }),
      );
    });

    it('should proxy PATCH requests with body', async () => {
      const event = createMockEvent({
        path: '/api/external/users/456',
        method: 'PATCH',
      });

      await handler(event);

      expect(mockReadRawBody).toHaveBeenCalledWith(event);
    });

    it('should proxy DELETE requests with body', async () => {
      const event = createMockEvent({
        path: '/api/external/items/789',
        method: 'DELETE',
      });

      await handler(event);

      expect(mockReadRawBody).toHaveBeenCalledWith(event);
    });

    it('should construct target URL correctly with tenant ID', async () => {
      const event = createMockEvent({
        path: '/api/external/nested/path/resource',
        tenantId: 'custom-tenant',
      });

      await handler(event);

      expect(mockSendProxy).toHaveBeenCalledWith(
        event,
        'https://api.app.com/custom-tenant/nested/path/resource',
        expect.any(Object),
      );
    });
  });

  describe('Error handling', () => {
    it('should handle timeout errors', async () => {
      const timeoutError = new Error('The operation was aborted');
      timeoutError.name = 'TimeoutError';
      mockSendProxy.mockRejectedValueOnce(timeoutError);

      const event = createMockEvent();

      await expect(handler(event)).rejects.toThrow();
      expect(createExternalApiError).toHaveBeenCalledWith(
        'External API',
        expect.objectContaining({
          message: expect.stringContaining('timed out'),
        }),
      );
    });

    it('should handle abort errors', async () => {
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';
      mockSendProxy.mockRejectedValueOnce(abortError);

      const event = createMockEvent();

      await expect(handler(event)).rejects.toThrow();
      expect(createExternalApiError).toHaveBeenCalledWith(
        'External API',
        expect.objectContaining({
          message: expect.stringContaining('aborted'),
        }),
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      mockSendProxy.mockRejectedValueOnce(networkError);

      const event = createMockEvent();

      await expect(handler(event)).rejects.toThrow();
      expect(createExternalApiError).toHaveBeenCalledWith(
        'External API',
        networkError,
      );
    });

    it('should handle generic errors', async () => {
      const genericError = new Error('Something went wrong');
      mockSendProxy.mockRejectedValueOnce(genericError);

      const event = createMockEvent();

      await expect(handler(event)).rejects.toThrow();
      expect(createExternalApiError).toHaveBeenCalledWith(
        'External API',
        genericError,
      );
    });

    it('should include timeout signal in fetch options', async () => {
      const event = createMockEvent();

      await handler(event);

      expect(mockSendProxy).toHaveBeenCalledWith(
        event,
        expect.any(String),
        expect.objectContaining({
          fetchOptions: expect.objectContaining({
            signal: expect.any(AbortSignal),
          }),
        }),
      );
    });
  });

  describe('Path handling', () => {
    it('should correctly strip /api/external/ prefix', async () => {
      const event = createMockEvent({
        path: '/api/external/some/deep/path',
        tenantId: 'tenant-123',
      });

      await handler(event);

      expect(mockSendProxy).toHaveBeenCalledWith(
        event,
        'https://api.app.com/tenant-123/some/deep/path',
        expect.any(Object),
      );
    });

    it('should handle paths with query parameters', async () => {
      const event = createMockEvent({
        path: '/api/external/search?q=test&page=1',
      });

      await handler(event);

      expect(mockSendProxy).toHaveBeenCalledWith(
        event,
        'https://api.app.com/test-tenant/search?q=test&page=1',
        expect.any(Object),
      );
    });
  });
});

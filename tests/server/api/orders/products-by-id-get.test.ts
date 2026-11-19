import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

const mockRequireAuth = vi.fn();
vi.mock('../../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

const mockGetLatestOrderForProduct = vi.fn();
vi.mock('../../../../server/services/purchased-products', () => ({
  getLatestOrderForProduct: (...args: unknown[]) =>
    mockGetLatestOrderForProduct(...args),
}));

vi.stubGlobal(
  'withErrorHandling',
  vi.fn(async (fn: () => Promise<unknown>) => fn()),
);
vi.stubGlobal('defineEventHandler', (fn: (event: H3Event) => unknown) => fn);
vi.stubGlobal('getRouterParam', vi.fn());
// As h3 does it: the params through the parser, a refusal answered 400.
vi.stubGlobal(
  'getValidatedRouterParams',
  vi.fn(async (event: H3Event, parse: (params: unknown) => unknown) => {
    try {
      return parse({ productId: getRouterParam(event, 'productId') });
    } catch {
      throw Object.assign(new Error('Validation Error'), { statusCode: 400 });
    }
  }),
);
vi.stubGlobal('setResponseHeader', vi.fn());

let handler: (event: H3Event) => Promise<unknown>;

describe('GET /api/orders/products/by-id/[productId]', () => {
  const mockEvent = {} as H3Event;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ authToken: 'test-token' });
    vi.mocked(getRouterParam).mockReturnValue('1031');
    handler = (
      await import('../../../../server/api/orders/products/by-id/[productId].get')
    ).default as unknown as (event: H3Event) => Promise<unknown>;
  });

  it('answers the newest order holding the product, asked by its numeric id', async () => {
    const order = {
      id: '1421',
      publicId: 'pub-1421',
      createdAt: '2026-05-18T12:34:56Z',
    };
    mockGetLatestOrderForProduct.mockResolvedValueOnce(order);

    expect(await handler(mockEvent)).toEqual({ order });
    expect(getRouterParam).toHaveBeenCalledWith(mockEvent, 'productId');
    expect(mockGetLatestOrderForProduct).toHaveBeenCalledWith(mockEvent, 1031);
  });

  it('answers null when the product was never ordered', async () => {
    mockGetLatestOrderForProduct.mockResolvedValueOnce(null);

    expect(await handler(mockEvent)).toEqual({ order: null });
  });

  it('marks a successful answer cacheable for five minutes', async () => {
    mockGetLatestOrderForProduct.mockResolvedValueOnce(null);

    await handler(mockEvent);

    expect(setResponseHeader).toHaveBeenCalledWith(
      mockEvent,
      'Cache-Control',
      'private, max-age=300, must-revalidate',
    );
  });

  it('names the operation for the error log', async () => {
    mockGetLatestOrderForProduct.mockResolvedValueOnce(null);

    await handler(mockEvent);

    expect(withErrorHandling).toHaveBeenCalledWith(expect.any(Function), {
      operation: 'orders.products.byId',
    });
  });

  // A cacheable error would be served again on the next product page visit.
  it('leaves a failed answer without a cache header', async () => {
    mockGetLatestOrderForProduct.mockRejectedValueOnce(
      new Error('SDK failure'),
    );

    await expect(handler(mockEvent)).rejects.toThrow('SDK failure');
    expect(setResponseHeader).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'abc', '0', '-1', '1.5', '2147483648'])(
    'answers the id %j with a 400, without asking Geins or a cache header',
    async (param) => {
      vi.mocked(getRouterParam).mockReturnValueOnce(param);

      await expect(handler(mockEvent)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(mockGetLatestOrderForProduct).not.toHaveBeenCalled();
      expect(setResponseHeader).not.toHaveBeenCalled();
    },
  );
});

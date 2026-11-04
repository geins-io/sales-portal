import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

/**
 * The order a quotation was finalized into, read by the number the quotation
 * carries. Answered like `/api/orders/[id]`, so a page can wait on it the same
 * way.
 */

const mockRequireAuth = vi.fn();
const mockOptionalAuth = vi.fn();
vi.mock('../../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  optionalAuth: (...args: unknown[]) => mockOptionalAuth(...args),
}));

const mockGetOrderByNumber = vi.fn();
vi.mock('../../../../server/services/orders', () => ({
  getOrderByNumber: (...args: unknown[]) => mockGetOrderByNumber(...args),
}));

vi.stubGlobal(
  'withErrorHandling',
  vi.fn(async (fn: () => Promise<unknown>) => fn()),
);
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, message: string) =>
    Object.assign(new Error(message), {
      statusCode: code === 'NOT_FOUND' ? 404 : 500,
    }),
  ),
);
vi.stubGlobal('ErrorCode', { NOT_FOUND: 'NOT_FOUND' });
vi.stubGlobal('defineEventHandler', (fn: (event: H3Event) => unknown) => fn);
vi.stubGlobal('getRouterParam', vi.fn());
// As h3 does it: the params through the parser, a refusal answered 400.
vi.stubGlobal(
  'getValidatedRouterParams',
  vi.fn(async (event: H3Event, parse: (params: unknown) => unknown) => {
    try {
      return parse({ number: getRouterParam(event, 'number') });
    } catch {
      throw Object.assign(new Error('Validation Error'), { statusCode: 400 });
    }
  }),
);
vi.stubGlobal('setResponseHeader', vi.fn());

const mockedGetRouterParam = vi.mocked(getRouterParam);

function eventWith(access?: 'all' | 'authenticated'): H3Event {
  const features = access ? { orderPlacement: { enabled: true, access } } : {};
  return {
    context: { tenant: { hostname: 'test.com', config: { features } } },
  } as unknown as H3Event;
}

let handler: (event: H3Event) => Promise<unknown>;

describe('GET /api/orders/by-number/[number]', () => {
  const event = eventWith();

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ authToken: 'test-token' });
    handler = (
      await import('../../../../server/api/orders/by-number/[number].get')
    ).default as unknown as (event: H3Event) => Promise<unknown>;
  });

  it('answers the order read by its number, as a number', async () => {
    mockedGetRouterParam.mockReturnValueOnce('1155');
    mockGetOrderByNumber.mockResolvedValueOnce({ id: 1155, publicId: 'pub' });

    await expect(handler(event)).resolves.toEqual({
      order: { id: 1155, publicId: 'pub' },
    });
    expect(mockedGetRouterParam).toHaveBeenCalledWith(event, 'number');
    expect(mockGetOrderByNumber).toHaveBeenCalledWith(1155, event);
    expect(withErrorHandling).toHaveBeenCalledWith(expect.any(Function), {
      operation: 'orders.getByNumber',
    });
  });

  it('needs the session the order read needs', async () => {
    mockRequireAuth.mockRejectedValueOnce(
      Object.assign(new Error('Authentication required'), { statusCode: 401 }),
    );

    await expect(handler(eventWith('authenticated'))).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(mockGetOrderByNumber).not.toHaveBeenCalled();
  });

  it("lets a signed-out request through when the tenant's orderPlacement is open to all", async () => {
    mockOptionalAuth.mockResolvedValueOnce(null);
    mockedGetRouterParam.mockReturnValueOnce('1155');
    mockGetOrderByNumber.mockResolvedValueOnce({ id: 1155 });

    await handler(eventWith('all'));

    expect(mockOptionalAuth).toHaveBeenCalled();
    expect(mockRequireAuth).not.toHaveBeenCalled();
  });

  it.each(['', 'abc', '0', '-5', '12.5', '1e3', ' 12', '0012', '2147483648'])(
    'refuses %j as an order number without asking Geins',
    async (raw) => {
      mockedGetRouterParam.mockReturnValueOnce(raw);

      await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
      expect(mockGetOrderByNumber).not.toHaveBeenCalled();
    },
  );

  it('takes the largest number Geins can be asked for', async () => {
    mockedGetRouterParam.mockReturnValueOnce('2147483647');
    mockGetOrderByNumber.mockResolvedValueOnce({ id: 2147483647 });

    await handler(event);

    expect(mockGetOrderByNumber).toHaveBeenCalledWith(2147483647, event);
  });

  it('answers 404 while the number gives no readable order, uncached', async () => {
    mockedGetRouterParam.mockReturnValueOnce('1155');
    mockGetOrderByNumber.mockResolvedValueOnce(undefined);

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 404 });
    expect(setResponseHeader).not.toHaveBeenCalled();
  });

  it('marks a successful answer cacheable for thirty seconds', async () => {
    mockedGetRouterParam.mockReturnValueOnce('1155');
    mockGetOrderByNumber.mockResolvedValueOnce({ id: 1155 });

    await handler(event);

    expect(setResponseHeader).toHaveBeenCalledWith(
      event,
      'Cache-Control',
      'private, max-age=30, must-revalidate',
    );
  });
});

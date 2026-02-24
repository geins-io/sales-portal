import { describe, it, expect, vi, beforeEach } from 'vitest';

// eslint-friendly callable type
type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Mock the search service module
// ---------------------------------------------------------------------------
const mockSearchProducts = vi.fn();

vi.mock('../../../server/services/search', () => ({
  searchProducts: (...args: unknown[]) => mockSearchProducts(...args),
}));

// ---------------------------------------------------------------------------
// Stub Nitro / h3 auto-imports
// ---------------------------------------------------------------------------
vi.stubGlobal('withErrorHandling', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal('getQuery', vi.fn());
vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fakeEvent = {} as unknown as import('h3').H3Event;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GET /api/search/products', () => {
  let handler: (event: import('h3').H3Event) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSearchProducts.mockResolvedValue({ products: [] });
    const mod = await import('../../../server/api/search/products.get.ts');
    handler = mod.default as (event: import('h3').H3Event) => Promise<unknown>;
  });

  it('builds filter with searchText and calls searchProducts', async () => {
    vi.mocked(getQuery).mockReturnValue({ query: 'shoes' });

    await handler(fakeEvent);

    expect(mockSearchProducts).toHaveBeenCalledOnce();
    expect(mockSearchProducts).toHaveBeenCalledWith(
      { filter: { searchText: 'shoes' } },
      fakeEvent,
    );
  });

  it('includes skip and take in filter when provided', async () => {
    vi.mocked(getQuery).mockReturnValue({
      query: 'jackets',
      skip: '0',
      take: '10',
    });

    await handler(fakeEvent);

    expect(mockSearchProducts).toHaveBeenCalledWith(
      { filter: { searchText: 'jackets', skip: 0, take: 10 } },
      fakeEvent,
    );
  });

  it('merges additional filter params', async () => {
    vi.mocked(getQuery).mockReturnValue({
      query: 'boots',
      filter: { color: 'red' },
    });

    await handler(fakeEvent);

    expect(mockSearchProducts).toHaveBeenCalledWith(
      { filter: { color: 'red', searchText: 'boots' } },
      fakeEvent,
    );
  });

  it('rejects empty query with Zod error', async () => {
    vi.mocked(getQuery).mockReturnValue({ query: '' });

    await expect(handler(fakeEvent)).rejects.toThrow();
  });

  it('rejects query longer than 200 characters', async () => {
    vi.mocked(getQuery).mockReturnValue({ query: 'a'.repeat(201) });

    await expect(handler(fakeEvent)).rejects.toThrow();
  });
});

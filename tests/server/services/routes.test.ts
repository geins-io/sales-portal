import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  resolveRoute,
  clearCategoryCache,
} from '../../../server/services/routes';

// Mock service dependencies
const mockGetCategories = vi.fn();
const mockGetProduct = vi.fn();
const mockGetPage = vi.fn();

vi.mock('../../../server/services/categories', () => ({
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
}));

vi.mock('../../../server/services/products', () => ({
  getProduct: (...args: unknown[]) => mockGetProduct(...args),
}));

vi.mock('../../../server/services/cms', () => ({
  getPage: (...args: unknown[]) => mockGetPage(...args),
}));

// Stub Nitro auto-imports
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal('getPreviewCookie', vi.fn().mockReturnValue(false));

function mockEvent(hostname = 'test.com') {
  return {
    context: { tenant: { hostname } },
  } as unknown as import('h3').H3Event;
}

describe('resolveRoute service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCategoryCache();
    mockGetCategories.mockResolvedValue([]);
    mockGetProduct.mockRejectedValue(new Error('not found'));
    mockGetPage.mockRejectedValue(new Error('not found'));
  });

  it('returns not-found for empty segments', async () => {
    const result = await resolveRoute([], mockEvent());
    expect(result).toEqual({ type: 'not-found' });
  });

  it('resolves single segment matching category', async () => {
    mockGetCategories.mockResolvedValue([{ alias: 'shoes', categoryId: 42 }]);

    const result = await resolveRoute(['shoes'], mockEvent());
    expect(result).toEqual({
      type: 'category',
      categoryId: '42',
      categorySlug: 'shoes',
    });
  });

  it('resolves category + subcategory to subcategory', async () => {
    mockGetCategories.mockResolvedValue([
      { alias: 'shoes', categoryId: 42 },
      { alias: 'sneakers', categoryId: 99 },
    ]);

    const result = await resolveRoute(['shoes', 'sneakers'], mockEvent());
    expect(result).toEqual({
      type: 'category',
      categoryId: '99',
      categorySlug: 'sneakers',
    });
  });

  it('resolves category + product slug to product', async () => {
    mockGetCategories.mockResolvedValue([{ alias: 'shoes', categoryId: 42 }]);
    mockGetProduct.mockResolvedValue({
      alias: 'red-sneaker',
      productId: 101,
      canonicalUrl: '/shoes/red-sneaker',
    });

    const result = await resolveRoute(['shoes', 'red-sneaker'], mockEvent());
    expect(result).toEqual({
      type: 'product',
      productId: '101',
      productSlug: 'red-sneaker',
      categorySlug: 'shoes',
      canonical: '/shoes/red-sneaker',
    });
  });

  it('resolves single segment as product when no category match', async () => {
    mockGetProduct.mockResolvedValue({
      alias: 'cool-jacket',
      productId: 200,
      canonicalUrl: '/cool-jacket',
    });

    const result = await resolveRoute(['cool-jacket'], mockEvent());
    expect(result).toEqual({
      type: 'product',
      productId: '200',
      productSlug: 'cool-jacket',
      canonical: '/cool-jacket',
    });
  });

  it('resolves single segment as CMS page when no category or product match', async () => {
    mockGetPage.mockResolvedValue({
      id: 'page-55',
      containers: [{ widgets: [] }],
    });

    const result = await resolveRoute(['about-us'], mockEvent());
    expect(result).toEqual({
      type: 'page',
      pageId: 'page-55',
      pageSlug: 'about-us',
    });
  });

  it('returns not-found when nothing matches', async () => {
    const result = await resolveRoute(['nonexistent'], mockEvent());
    expect(result).toEqual({ type: 'not-found' });
  });

  it('uses cached category map on second call', async () => {
    mockGetCategories.mockResolvedValue([{ alias: 'shoes', categoryId: 42 }]);

    await resolveRoute(['shoes'], mockEvent());
    await resolveRoute(['shoes'], mockEvent());

    // getCategories should only be called once due to caching
    expect(mockGetCategories).toHaveBeenCalledTimes(1);
  });

  it('returns empty map on category fetch failure, falls through to product/page', async () => {
    mockGetCategories.mockRejectedValue(new Error('API error'));
    mockGetProduct.mockResolvedValue({
      alias: 'shoes',
      productId: 300,
    });

    const result = await resolveRoute(['shoes'], mockEvent());
    expect(result).toEqual({
      type: 'product',
      productId: '300',
      productSlug: 'shoes',
    });
  });

  it('resolves 3-segment path as category/subcategory/product', async () => {
    mockGetCategories.mockResolvedValue([
      { alias: 'clothing', categoryId: 10 },
      { alias: 'shoes', categoryId: 20 },
    ]);
    mockGetProduct.mockResolvedValue({
      alias: 'red-sneaker',
      productId: 101,
      canonicalUrl: '/clothing/shoes/red-sneaker',
    });

    const result = await resolveRoute(
      ['clothing', 'shoes', 'red-sneaker'],
      mockEvent(),
    );
    expect(result).toEqual({
      type: 'product',
      productId: '101',
      productSlug: 'red-sneaker',
      categorySlug: 'shoes',
      canonical: '/clothing/shoes/red-sneaker',
    });
  });

  it('isolates category cache per tenant hostname', async () => {
    mockGetCategories
      .mockResolvedValueOnce([{ alias: 'shoes', categoryId: 42 }])
      .mockResolvedValueOnce([{ alias: 'shoes', categoryId: 99 }]);

    const result1 = await resolveRoute(['shoes'], mockEvent('tenant-a.com'));
    const result2 = await resolveRoute(['shoes'], mockEvent('tenant-b.com'));

    expect(mockGetCategories).toHaveBeenCalledTimes(2);
    expect(result1).toEqual({
      type: 'category',
      categoryId: '42',
      categorySlug: 'shoes',
    });
    expect(result2).toEqual({
      type: 'category',
      categoryId: '99',
      categorySlug: 'shoes',
    });
  });
});

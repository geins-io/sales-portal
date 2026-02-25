import { describe, it, expect } from 'vitest';
import {
  ProductAliasSchema,
  ProductReviewsSchema,
  PostReviewSchema,
  MonitorAvailabilitySchema,
  ProductListSchema,
  ListPageSchema,
  SearchProductsSchema,
  CartIdSchema,
  CartAddItemSchema,
  CartUpdateItemSchema,
  CartDeleteItemSchema,
  CartPromoCodeSchema,
  CmsMenuSchema,
} from '~~/server/schemas/api-input';

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

describe('ProductAliasSchema', () => {
  it('accepts a valid alias', () => {
    const result = ProductAliasSchema.safeParse({ alias: 'my-product' });
    expect(result.success).toBe(true);
  });

  it('rejects empty alias', () => {
    const result = ProductAliasSchema.safeParse({ alias: '' });
    expect(result.success).toBe(false);
  });

  it('rejects alias over 200 chars', () => {
    const result = ProductAliasSchema.safeParse({ alias: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('rejects missing alias', () => {
    const result = ProductAliasSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('ProductReviewsSchema', () => {
  it('accepts alias only', () => {
    const result = ProductReviewsSchema.safeParse({ alias: 'product-1' });
    expect(result.success).toBe(true);
  });

  it('accepts all fields', () => {
    const result = ProductReviewsSchema.safeParse({
      alias: 'product-1',
      skip: 0,
      take: 10,
    });
    expect(result.success).toBe(true);
  });

  it('coerces string skip to number', () => {
    const result = ProductReviewsSchema.safeParse({
      alias: 'product-1',
      skip: '5',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skip).toBe(5);
    }
  });

  it('coerces string take to number', () => {
    const result = ProductReviewsSchema.safeParse({
      alias: 'product-1',
      take: '25',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.take).toBe(25);
    }
  });

  it('rejects negative skip', () => {
    const result = ProductReviewsSchema.safeParse({
      alias: 'product-1',
      skip: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects take over 50', () => {
    const result = ProductReviewsSchema.safeParse({
      alias: 'product-1',
      take: 51,
    });
    expect(result.success).toBe(false);
  });

  it('rejects take of 0', () => {
    const result = ProductReviewsSchema.safeParse({
      alias: 'product-1',
      take: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('PostReviewSchema', () => {
  it('accepts valid review with comment', () => {
    const result = PostReviewSchema.safeParse({
      alias: 'product-1',
      rating: 4,
      author: 'Jane',
      comment: 'Great product!',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid review without comment', () => {
    const result = PostReviewSchema.safeParse({
      alias: 'product-1',
      rating: 1,
      author: 'Bob',
    });
    expect(result.success).toBe(true);
  });

  it('rejects rating below 1', () => {
    const result = PostReviewSchema.safeParse({
      alias: 'p',
      rating: 0,
      author: 'Bob',
    });
    expect(result.success).toBe(false);
  });

  it('rejects rating above 5', () => {
    const result = PostReviewSchema.safeParse({
      alias: 'p',
      rating: 6,
      author: 'Bob',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty author', () => {
    const result = PostReviewSchema.safeParse({
      alias: 'p',
      rating: 3,
      author: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects author over 100 chars', () => {
    const result = PostReviewSchema.safeParse({
      alias: 'p',
      rating: 3,
      author: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('rejects comment over 2000 chars', () => {
    const result = PostReviewSchema.safeParse({
      alias: 'p',
      rating: 3,
      author: 'Bob',
      comment: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe('MonitorAvailabilitySchema', () => {
  it('accepts valid email and skuId', () => {
    const result = MonitorAvailabilitySchema.safeParse({
      email: 'user@example.com',
      skuId: 12345,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = MonitorAvailabilitySchema.safeParse({
      email: 'not-an-email',
      skuId: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing skuId', () => {
    const result = MonitorAvailabilitySchema.safeParse({
      email: 'user@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-number skuId', () => {
    const result = MonitorAvailabilitySchema.safeParse({
      email: 'user@example.com',
      skuId: 'abc',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Product Lists
// ---------------------------------------------------------------------------

describe('ProductListSchema', () => {
  it('accepts empty object (all optional)', () => {
    const result = ProductListSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts all fields', () => {
    const result = ProductListSchema.safeParse({
      skip: 0,
      take: 50,
      categoryAlias: 'shoes',
      brandAlias: 'nike',
      discountCampaignAlias: 'summer-sale',
      filter: { color: 'red' },
    });
    expect(result.success).toBe(true);
  });

  it('coerces string skip to number', () => {
    const result = ProductListSchema.safeParse({ skip: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skip).toBe(10);
    }
  });

  it('coerces string take to number', () => {
    const result = ProductListSchema.safeParse({ take: '20' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.take).toBe(20);
    }
  });

  it('rejects take over 100', () => {
    const result = ProductListSchema.safeParse({ take: 101 });
    expect(result.success).toBe(false);
  });

  it('rejects take of 0', () => {
    const result = ProductListSchema.safeParse({ take: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative skip', () => {
    const result = ProductListSchema.safeParse({ skip: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects categoryAlias over 200 chars', () => {
    const result = ProductListSchema.safeParse({
      categoryAlias: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

describe('ListPageSchema', () => {
  it('accepts a valid alias', () => {
    const result = ListPageSchema.safeParse({ alias: 'shoes' });
    expect(result.success).toBe(true);
  });

  it('rejects empty alias', () => {
    const result = ListPageSchema.safeParse({ alias: '' });
    expect(result.success).toBe(false);
  });

  it('rejects alias over 200 chars', () => {
    const result = ListPageSchema.safeParse({ alias: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

describe('SearchProductsSchema', () => {
  it('accepts query only', () => {
    const result = SearchProductsSchema.safeParse({ query: 'red shoes' });
    expect(result.success).toBe(true);
  });

  it('accepts all fields', () => {
    const result = SearchProductsSchema.safeParse({
      query: 'shoes',
      skip: 0,
      take: 20,
      filter: { brand: 'nike' },
    });
    expect(result.success).toBe(true);
  });

  it('coerces string skip to number', () => {
    const result = SearchProductsSchema.safeParse({
      query: 'shoes',
      skip: '5',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skip).toBe(5);
    }
  });

  it('coerces string take to number', () => {
    const result = SearchProductsSchema.safeParse({
      query: 'shoes',
      take: '10',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.take).toBe(10);
    }
  });

  it('rejects empty query', () => {
    const result = SearchProductsSchema.safeParse({ query: '' });
    expect(result.success).toBe(false);
  });

  it('rejects query over 200 chars', () => {
    const result = SearchProductsSchema.safeParse({
      query: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('rejects take over 50', () => {
    const result = SearchProductsSchema.safeParse({
      query: 'shoes',
      take: 51,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative skip', () => {
    const result = SearchProductsSchema.safeParse({
      query: 'shoes',
      skip: -1,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

describe('CartIdSchema', () => {
  it('accepts a valid cartId', () => {
    const result = CartIdSchema.safeParse({ cartId: 'cart-abc-123' });
    expect(result.success).toBe(true);
  });

  it('rejects empty cartId', () => {
    const result = CartIdSchema.safeParse({ cartId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing cartId', () => {
    const result = CartIdSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('CartAddItemSchema', () => {
  it('accepts valid input', () => {
    const result = CartAddItemSchema.safeParse({
      cartId: 'cart-1',
      skuId: 100,
      quantity: 2,
    });
    expect(result.success).toBe(true);
  });

  it('rejects quantity of 0', () => {
    const result = CartAddItemSchema.safeParse({
      cartId: 'cart-1',
      skuId: 100,
      quantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects quantity over 999', () => {
    const result = CartAddItemSchema.safeParse({
      cartId: 'cart-1',
      skuId: 100,
      quantity: 1000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing skuId', () => {
    const result = CartAddItemSchema.safeParse({
      cartId: 'cart-1',
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-number skuId', () => {
    const result = CartAddItemSchema.safeParse({
      cartId: 'cart-1',
      skuId: 'abc',
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe('CartUpdateItemSchema', () => {
  it('accepts valid input with quantity 0 (remove)', () => {
    const result = CartUpdateItemSchema.safeParse({
      cartId: 'cart-1',
      itemId: 'item-1',
      quantity: 0,
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid input with positive quantity', () => {
    const result = CartUpdateItemSchema.safeParse({
      cartId: 'cart-1',
      itemId: 'item-1',
      quantity: 5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative quantity', () => {
    const result = CartUpdateItemSchema.safeParse({
      cartId: 'cart-1',
      itemId: 'item-1',
      quantity: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects quantity over 999', () => {
    const result = CartUpdateItemSchema.safeParse({
      cartId: 'cart-1',
      itemId: 'item-1',
      quantity: 1000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty itemId', () => {
    const result = CartUpdateItemSchema.safeParse({
      cartId: 'cart-1',
      itemId: '',
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe('CartDeleteItemSchema', () => {
  it('accepts valid input', () => {
    const result = CartDeleteItemSchema.safeParse({
      cartId: 'cart-1',
      itemId: 'item-1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty cartId', () => {
    const result = CartDeleteItemSchema.safeParse({
      cartId: '',
      itemId: 'item-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty itemId', () => {
    const result = CartDeleteItemSchema.safeParse({
      cartId: 'cart-1',
      itemId: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = CartDeleteItemSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('CartPromoCodeSchema', () => {
  it('accepts valid input', () => {
    const result = CartPromoCodeSchema.safeParse({
      cartId: 'cart-1',
      promoCode: 'SAVE10',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty promoCode', () => {
    const result = CartPromoCodeSchema.safeParse({
      cartId: 'cart-1',
      promoCode: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects promoCode over 50 chars', () => {
    const result = CartPromoCodeSchema.safeParse({
      cartId: 'cart-1',
      promoCode: 'A'.repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty cartId', () => {
    const result = CartPromoCodeSchema.safeParse({
      cartId: '',
      promoCode: 'SAVE10',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Existing CmsMenuSchema (sanity check for the import)
// ---------------------------------------------------------------------------

describe('CmsMenuSchema', () => {
  it('accepts valid menuLocationId', () => {
    const result = CmsMenuSchema.safeParse({ menuLocationId: 'main-nav' });
    expect(result.success).toBe(true);
  });

  it('rejects empty menuLocationId', () => {
    const result = CmsMenuSchema.safeParse({ menuLocationId: '' });
    expect(result.success).toBe(false);
  });
});

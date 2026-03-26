import { describe, it, expect, vi } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import ProductCard from '../../../app/components/shared/ProductCard.vue';

// useTenant and useLocaleMarket mocks are provided by setup-components.ts

vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canAccess: vi.fn(() => true) }),
}));

vi.mock('~/stores/cart', () => ({
  useCartStore: () => ({
    addItem: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

vi.mock('~/stores/favorites', () => ({
  useFavoritesStore: () => ({
    isFavorite: vi.fn(() => false),
    toggle: vi.fn(),
  }),
}));

const baseProduct = {
  alias: 'test-product',
  name: 'Test Product',
  productImages: [{ fileName: 'test.jpg' }],
  skus: [{ skuId: 1 }],
  totalStock: { totalStock: 10 },
  unitPrice: {
    sellingPriceIncVat: 100,
    sellingPriceExVat: 80,
    currency: 'SEK',
  },
};

describe('ProductCard URL regression', () => {
  it('product URL strips /p/ prefix from canonicalUrl', () => {
    // Regression: canonicalUrl from Geins includes /se/sv/p/cat/product-alias
    // but our app routes don't use /p/. stripGeinsPrefix should strip it.
    const wrapper = shallowMountComponent(ProductCard, {
      props: {
        product: {
          ...baseProduct,
          canonicalUrl: '/se/sv/p/cat/test-product',
        },
      },
    });

    const links = wrapper.findAll('a');
    const hrefs = links.map((l) => l.attributes('href'));

    // The URL should NOT contain /p/ — localePath mock prepends /se/en/
    expect(hrefs.some((h) => h === '/se/en/cat/test-product')).toBe(true);
    expect(hrefs.every((h) => !h?.includes('/p/'))).toBe(true);
  });

  it('product URL fallback uses localePath with /{alias}', () => {
    // When no canonicalUrl, fallback should use localePath('/{alias}')
    const wrapper = shallowMountComponent(ProductCard, {
      props: {
        product: {
          ...baseProduct,
          canonicalUrl: undefined,
        },
      },
    });

    const links = wrapper.findAll('a');
    const hrefs = links.map((l) => l.attributes('href'));

    // localePath mock in setup-components.ts returns /se/en/{path}
    expect(hrefs.some((h) => h === '/se/en/test-product')).toBe(true);
    // Must NOT have /p/ in the fallback path
    expect(hrefs.every((h) => !h?.includes('/p/'))).toBe(true);
  });

  it('product URL strips market/locale prefix from canonicalUrl', () => {
    // CMS canonical URLs include the full /market/locale/type/... path
    const wrapper = shallowMountComponent(ProductCard, {
      props: {
        product: {
          ...baseProduct,
          canonicalUrl: '/se/sv/l/category-alias',
        },
      },
    });

    const links = wrapper.findAll('a');
    const hrefs = links.map((l) => l.attributes('href'));

    // /l/ type indicator should be stripped along with market/locale; localePath mock prepends /se/en/
    expect(hrefs.some((h) => h === '/se/en/category-alias')).toBe(true);
  });
});

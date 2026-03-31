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

describe('ProductCard URL with Ralph-style routing', () => {
  it('product URL adds /p/ prefix and strips market/locale from canonicalUrl', () => {
    // Geins API returns canonicalUrl with market/locale but NO type prefix:
    //   /se/sv/cat/test-product
    // productPath strips locale → /p/cat/test-product
    // localePath (mock) prepends /se/en/ → /se/en/p/cat/test-product
    const wrapper = shallowMountComponent(ProductCard, {
      props: {
        product: {
          ...baseProduct,
          canonicalUrl: '/se/sv/cat/test-product',
        },
      },
    });

    const links = wrapper.findAll('a');
    const hrefs = links.map((l) => l.attributes('href'));

    expect(hrefs.some((h) => h === '/se/en/p/cat/test-product')).toBe(true);
  });

  it('product URL fallback uses /p/{alias} when no canonicalUrl', () => {
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

    // localePath('/p/test-product') → /se/en/p/test-product
    expect(hrefs.some((h) => h === '/se/en/p/test-product')).toBe(true);
  });

  it('product URL handles canonicalUrl without market/locale prefix', () => {
    const wrapper = shallowMountComponent(ProductCard, {
      props: {
        product: {
          ...baseProduct,
          canonicalUrl: '/cat/test-product',
        },
      },
    });

    const links = wrapper.findAll('a');
    const hrefs = links.map((l) => l.attributes('href'));

    // productPath('/cat/test-product') → /p/cat/test-product
    // localePath → /se/en/p/cat/test-product
    expect(hrefs.some((h) => h === '/se/en/p/cat/test-product')).toBe(true);
  });
});

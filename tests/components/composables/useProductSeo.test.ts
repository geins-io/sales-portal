import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import type { DetailProduct } from '../../../shared/types/commerce';

// What the head ends up as is @unhead's business; what this composable decides
// is which product facts go in — above all whether an offer is published at
// all, which is the one thing that differs between the product pages.
const { defineProductMock, defineBreadcrumbMock } = vi.hoisted(() => ({
  defineProductMock: vi.fn((input: Record<string, unknown>) => input),
  defineBreadcrumbMock: vi.fn((input: Record<string, unknown>) => input),
}));

vi.stubGlobal('defineProduct', defineProductMock);
vi.stubGlobal('defineBreadcrumb', defineBreadcrumbMock);
vi.stubGlobal('useHead', vi.fn());
vi.stubGlobal('useSchemaOrg', vi.fn());
vi.mock('@unhead/schema-org/vue', () => ({
  defineProduct: defineProductMock,
  defineBreadcrumb: defineBreadcrumbMock,
}));

const { schemaOrgComposablePath } = vi.hoisted(() => {
  const nodeModule = require.resolve('nuxt-schema-org/schema');
  const pkgRoot = nodeModule.replace(/\/dist\/schema\..*$/, '');
  return {
    schemaOrgComposablePath: `${pkgRoot}/dist/runtime/app/composables/useSchemaOrg`,
  };
});
vi.mock(schemaOrgComposablePath, () => ({ useSchemaOrg: vi.fn() }));

vi.mock('../../../app/composables/useSeoLinks', () => ({
  useSeoLinks: () => ({
    seoLinks: ref([
      { rel: 'canonical', href: 'https://shop.test/se/sv/p/arbetsbord-pro' },
    ]),
  }),
}));

const { useProductSeo } =
  await import('../../../app/composables/useProductSeo');

function makeProduct(overrides: Record<string, unknown> = {}): DetailProduct {
  return {
    name: 'Arbetsbord Pro',
    texts: { text1: '<p>Ett höj- och sänkbart bord.</p>' },
    productImages: [
      { fileName: 'a.jpg', isPrimary: false, url: 'https://cdn.test/a.jpg' },
      { fileName: 'b.jpg', isPrimary: true, url: 'https://cdn.test/b.jpg' },
    ],
    unitPrice: { sellingPriceIncVat: 4100, currency: { code: 'SEK' } },
    totalStock: { inStock: 3 },
    ...overrides,
  } as unknown as DetailProduct;
}

function run(product: DetailProduct, withOffers: boolean, sku?: () => string) {
  useProductSeo({
    product: () => product,
    path: () => '/p/arbetsbord-pro',
    breadcrumbs: () => [
      { label: 'Hem', href: '/se/sv' },
      { label: 'Arbetsbord Pro' },
    ],
    localeAlternates: {},
    sku,
    withOffers,
  });
  return {
    product: defineProductMock.mock.calls.at(-1)![0] as Record<
      string,
      () => unknown
    >,
    breadcrumb: defineBreadcrumbMock.mock.calls.at(-1)![0] as Record<
      string,
      () => Array<{ position: number; name: string; item?: string }>
    >,
  };
}

beforeEach(() => {
  defineProductMock.mockClear();
  defineBreadcrumbMock.mockClear();
});

describe('useProductSeo', () => {
  it('publishes an offer for a product that has one price', () => {
    const { product } = run(makeProduct(), true);

    expect(product.offers!()).toEqual({
      '@type': 'Offer',
      price: 4100,
      priceCurrency: 'SEK',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
    });
  });

  it('publishes no offer when the price depends on a configuration', () => {
    const { product } = run(makeProduct(), false);

    expect(product.offers!()).toBeUndefined();
  });

  it('says out of stock when nothing is in stock', () => {
    const { product } = run(makeProduct({ totalStock: { inStock: 0 } }), true);

    expect((product.offers!() as { availability: string }).availability).toBe(
      'https://schema.org/OutOfStock',
    );
  });

  it('publishes no offer for a product with no price at all', () => {
    const { product } = run(makeProduct({ unitPrice: null }), true);

    expect(product.offers!()).toBeUndefined();
  });

  it('describes the product in plain text, capped for a meta description', () => {
    const long = `<p>${'a'.repeat(300)}</p>`;
    const { product } = run(makeProduct({ texts: { text1: long } }), false);

    expect(product.description!()).toBe('a'.repeat(160));
  });

  it('publishes every product image, in the order they arrive', () => {
    const { product } = run(makeProduct(), false);

    expect(product.image!()).toEqual([
      'https://cdn.test/a.jpg',
      'https://cdn.test/b.jpg',
    ]);
  });

  it('numbers the breadcrumb trail from one and keeps the last one hrefless', () => {
    const { breadcrumb } = run(makeProduct(), false);

    expect(breadcrumb.itemListElement!()).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Hem', item: '/se/sv' },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Arbetsbord Pro',
        item: undefined,
      },
    ]);
  });

  it('publishes the sku the page resolved, and an empty one when it has none', () => {
    expect(run(makeProduct(), true, () => '101').product.sku!()).toBe('101');
    expect(run(makeProduct(), false).product.sku!()).toBe('');
  });

  it('publishes the brand only when the product has one', () => {
    expect(
      run(makeProduct({ brand: { name: 'Geins' } }), false).product.brand!(),
    ).toEqual({ '@type': 'Brand', name: 'Geins' });
    expect(run(makeProduct(), false).product.brand!()).toBeUndefined();
  });
});

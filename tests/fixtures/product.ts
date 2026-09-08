import type { ListProduct } from '#shared/types/commerce';

// ---------------------------------------------------------------------------
// Shared list-product fixture.
//
// `ListProduct` has ten required fields, so an ad-hoc `{ productId, name }`
// literal never satisfied it — it only looked like coverage because nothing
// type-checked these files. Defaults here are the minimum that type-checks;
// pass overrides for the fields a test actually asserts on.
// ---------------------------------------------------------------------------

export function makeListProduct(
  overrides: Partial<ListProduct> = {},
): ListProduct {
  const id = overrides.productId ?? 1;
  return {
    productId: id,
    name: `Product ${id}`,
    alias: `product-${id}`,
    canonicalUrl: `/products/product-${id}`,
    articleNumber: `ART-${id}`,
    brand: { name: 'Brand' },
    primaryCategory: { name: 'Category' },
    unitPrice: {
      sellingPriceIncVat: 100,
      sellingPriceIncVatFormatted: '100 kr',
      isDiscounted: false,
    },
    productImages: [
      {
        fileName: `product-${id}.jpg`,
        url: `/i/product-${id}.jpg`,
        isPrimary: true,
      },
    ],
    totalStock: { inStock: 10, oversellable: 0, totalStock: 10, static: 0 },
    skus: [],
    discountCampaigns: [],
    ...overrides,
  };
}

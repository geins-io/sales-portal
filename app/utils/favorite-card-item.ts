import type { ProductCardItem } from '~/components/shared/ProductCard.vue';

// Minimal product shape returned by /api/products/by-aliases. We only need
// the fields consumed by the card + add-to-cart handler.
export interface FavoriteProduct {
  alias?: string | null;
  name?: string | null;
  articleNumber?: string | null;
  productImages?: Array<{
    fileName?: string | null;
    url?: string | null;
  } | null> | null;
  unitPrice?: {
    isDiscounted?: boolean | null;
    regularPriceIncVat?: number | null;
    regularPriceIncVatFormatted?: string | null;
    sellingPriceIncVat?: number | null;
    sellingPriceIncVatFormatted?: string | null;
    regularPriceExVat?: number | null;
    regularPriceExVatFormatted?: string | null;
    sellingPriceExVat?: number | null;
    sellingPriceExVatFormatted?: string | null;
  } | null;
  skus?: Array<{ skuId?: number | null } | null> | null;
  configurable?: boolean;
}

export function toFavoriteCardItem(
  product: FavoriteProduct,
  showIncVat: boolean,
): ProductCardItem {
  const unitPrice = product.unitPrice;
  const regular = showIncVat
    ? unitPrice?.regularPriceIncVat
    : unitPrice?.regularPriceExVat;
  const selling = showIncVat
    ? unitPrice?.sellingPriceIncVat
    : unitPrice?.sellingPriceExVat;
  const regularFormatted = showIncVat
    ? unitPrice?.regularPriceIncVatFormatted
    : unitPrice?.regularPriceExVatFormatted;
  const sellingFormatted = showIncVat
    ? unitPrice?.sellingPriceIncVatFormatted
    : unitPrice?.sellingPriceExVatFormatted;
  const hasDiscount =
    unitPrice?.isDiscounted === true ||
    (regular != null && selling != null && regular > selling);

  return {
    name: product.name ?? '',
    imageFileName: product.productImages?.[0]?.fileName ?? null,
    imageUrl: product.productImages?.[0]?.url ?? null,
    price: hasDiscount
      ? (regularFormatted ?? null)
      : (sellingFormatted ?? null),
    salePrice: hasDiscount ? (sellingFormatted ?? null) : null,
    articleNumber: product.articleNumber ?? null,
    alias: product.alias ?? null,
    ...(product.configurable === true && { configurable: true }),
  };
}

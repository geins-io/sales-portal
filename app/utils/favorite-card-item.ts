import type { ProductCardItem } from '~/components/shared/ProductCard.vue';

// Minimal product shape returned by /api/products/by-aliases. We only need
// the fields the card consumes, its sku included.
export interface FavoriteProduct {
  /** The alias the favorite is stored under, whatever its language. */
  alias?: string | null;
  /** The product page in the language of the page. */
  canonicalUrl?: string | null;
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
  const skus = (product.skus ?? []).filter((s) => s?.skuId != null);
  const skuId = skus[0]?.skuId;
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
    ...(product.canonicalUrl && { canonicalUrl: product.canonicalUrl }),
    ...(skuId != null && { skuId }),
    ...(skus.length > 0 && { skuCount: skus.length }),
    ...(product.configurable === true && { configurable: true }),
  };
}

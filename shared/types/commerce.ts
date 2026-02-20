export type {
  ProductType,
  PriceType,
  StockType,
  SkuType,
  ProductImageType,
  CurrencyType,
  BrandType,
  ProductTextsType,
  CategoryType,
  VariantDimensionType,
  VariantType,
  MetadataType,
  RatingType,
  LowestPriceType,
} from '@geins/types';

/** Stock availability state — derived from StockType fields */
export type StockStatus =
  | 'in-stock'
  | 'low-stock'
  | 'out-of-stock'
  | 'on-demand';

/**
 * Derive stock status from StockType.
 * ralph-ui reference: MixStockHandler
 */
export function getStockStatus(
  stock: { totalStock: number; inStock: number; static: number },
  threshold = 5,
): StockStatus {
  if (stock.totalStock === 0 && stock.static > 0) return 'on-demand';
  if (stock.totalStock === 0) return 'out-of-stock';
  if (stock.totalStock <= threshold) return 'low-stock';
  return 'in-stock';
}

/**
 * Format a raw price number using Intl.NumberFormat.
 * Fallback when API-formatted strings are missing.
 */
export function formatPrice(
  value: number,
  currencyCode = 'SEK',
  locale = 'sv-SE',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  }).format(value);
}

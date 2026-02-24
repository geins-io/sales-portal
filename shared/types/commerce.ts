import type {
  PriceType,
  ProductImageType,
  StockType,
  SkuType,
  MetadataType,
} from '@geins/types';

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
  VariantGroupType,
  ParameterGroupType,
  AttributeType,
  BreadcrumbType,
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

// ---------------------------------------------------------------------------
// Cart types (re-exported from SDK)
// ---------------------------------------------------------------------------
export type {
  CartType,
  CartItemType,
  CartItemInputType,
  CartSummaryType,
} from '@geins/types';

// ---------------------------------------------------------------------------
// List Product (subset of ProductType returned by product-list queries)
// ---------------------------------------------------------------------------
export interface ListProduct {
  productId: number;
  name: string;
  alias: string;
  canonicalUrl: string;
  articleNumber: string;
  brand: { name: string };
  primaryCategory: { name: string };
  unitPrice: PriceType;
  productImages: ProductImageType[];
  totalStock: StockType;
  skus: SkuType[];
  discountCampaigns: { name: string; hideTitle: boolean }[];
}

// ---------------------------------------------------------------------------
// Filter types (from ListFilters GraphQL fragment)
// ---------------------------------------------------------------------------
export interface FilterFacet {
  filterId: string;
  group: string;
  label: string;
  type: string;
  values: FilterValue[];
}

export interface FilterValue {
  _id: string;
  count: number;
  facetId: string;
  parentId: string | null;
  label: string;
  order: number;
  hidden: boolean;
}

// ---------------------------------------------------------------------------
// Page info (from ListInfo GraphQL fragment — for category/brand page headers)
// ---------------------------------------------------------------------------
export interface ListPageInfo {
  alias: string;
  canonicalUrl: string;
  primaryImage: string;
  name: string;
  id: string;
  primaryDescription: string;
  secondaryDescription: string;
  hideTitle: boolean;
  hideDescription: boolean;
  logo: string;
  meta: MetadataType;
  subCategories?: { name: string; alias: string; canonicalUrl: string }[];
}

// ---------------------------------------------------------------------------
// Review types
// ---------------------------------------------------------------------------
export interface ProductReview {
  rating: number;
  comment: string;
  reviewDate: string;
  author: string;
}

export interface ReviewsResponse {
  count: number;
  reviews: ProductReview[];
  averageRating: number;
}

// ---------------------------------------------------------------------------
// Product list response
// ---------------------------------------------------------------------------
export interface ProductListResponse {
  products: ListProduct[];
  count: number;
}

export interface ProductFiltersResponse {
  count: number;
  filters: FilterFacet[];
}

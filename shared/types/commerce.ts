import type {
  PriceType,
  ProductImageType,
  ProductType,
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
  AttributeType,
  BreadcrumbType,
  MetadataType,
  RatingType,
  LowestPriceType,
} from '@geins/types';

/**
 * Parameter group as returned by the GraphQL API.
 * NOTE: The SDK's ParameterGroupType uses `groupName` but the actual
 * GraphQL schema returns `name`. This local type matches the real response.
 */
export interface ParameterGroupType {
  name: string;
  parameterGroupId: number;
  parameters: {
    name?: string;
    label?: string;
    description?: string;
    value?: string;
    show: boolean;
    identifier?: string;
  }[];
}

/** Stock availability state — derived from StockType fields */
export type StockStatus =
  | 'in-stock'
  | 'low-stock'
  | 'out-of-stock'
  | 'on-demand';

/**
 * Derive stock status from StockType.
 * Geins stock field mapping
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
  CartItemProductType,
  CartSummaryType,
} from '@geins/types';

// ---------------------------------------------------------------------------
// Discount & lowest-price types (from enriched pricing GraphQL fragments)
// ---------------------------------------------------------------------------
export type ProductDiscountType =
  | 'NONE'
  | 'SALE_PRICE'
  | 'PRICE_CAMPAIGN'
  | 'EXTERNAL';

export interface LowestPriceInfo {
  lowestPriceIncVat: number;
  lowestPriceIncVatFormatted?: string;
  lowestPriceExVat: number;
  lowestPriceExVatFormatted?: string;
  comparisonPriceIncVat: number;
  comparisonPriceIncVatFormatted?: string;
  comparisonPriceExVat: number;
  comparisonPriceExVatFormatted?: string;
  isDiscounted: boolean;
  discountPercentage: number;
}

// ---------------------------------------------------------------------------
// Campaign types & utilities
// ---------------------------------------------------------------------------

/** Minimal campaign shape shared across product, cart item, and cart-level campaigns */
export interface CampaignInfo {
  name: string;
  hideTitle: boolean;
}

/** Filter campaigns to only those with visible titles */
export function filterVisibleCampaigns<T extends { hideTitle?: boolean }>(
  campaigns: T[],
): T[] {
  return campaigns.filter((c) => !c.hideTitle);
}

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
  lowestPrice?: LowestPriceInfo;
  discountType?: ProductDiscountType;
}

// ---------------------------------------------------------------------------
// Detail Product (ProductType with enriched pricing fields from GraphQL)
// ---------------------------------------------------------------------------
/**
 * Extends the SDK ProductType with fields that come from our enriched
 * GraphQL product queries (discount campaigns, discount type, lowest price).
 * The SDK types use different shapes (e.g. DiscountType enum vs string,
 * LowestPriceType vs LowestPriceInfo) so we augment rather than re-export.
 */
export interface DetailProduct extends Omit<
  ProductType,
  'discountType' | 'lowestPrice' | 'parameterGroups'
> {
  parameterGroups?: ParameterGroupType[];
  discountCampaigns?: { name: string; hideTitle: boolean }[];
  lowestPrice?: LowestPriceInfo;
  discountType?: ProductDiscountType;
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
  filters: { facets: FilterFacet[] };
}

// ---------------------------------------------------------------------------
// Checkout payment terms (extended — not yet available in SDK types)
// ---------------------------------------------------------------------------
export interface CheckoutPaymentTerms {
  name: string;
  description?: string;
  days?: number;
}

// ---------------------------------------------------------------------------
// Order list item (subset of OrderSummaryType for list views)
// ---------------------------------------------------------------------------
export interface OrderListItem {
  id?: number | null;
  publicId?: string | null;
  status: string;
  createdAt?: string | null;
  billingAddress?: {
    firstName?: string;
    lastName?: string;
    company?: string;
  } | null;
  cart?: {
    summary?: {
      total?: {
        sellingPriceIncVat?: number;
        sellingPriceIncVatFormatted?: string;
      } | null;
    } | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Purchased product (aggregated from order history)
// ---------------------------------------------------------------------------
export interface PurchasedProduct {
  name: string;
  articleNumber: string;
  priceExVat: number;
  priceExVatFormatted?: string;
  totalQuantity: number;
  latestOrderDate: string;
  latestOrderId: string;
  latestBuyerName: string;
}

// ---------------------------------------------------------------------------
// Checkout & Order types (re-exported from SDK)
// ---------------------------------------------------------------------------
export type {
  CheckoutType,
  CheckoutInputType,
  AddressInputType,
  CreateOrderOptions,
  CreateOrderResponseType,
  ValidateOrderCreationResponseType,
  CheckoutSummaryType,
  CheckoutSummaryOrderType,
  CheckoutSummaryOrderRowType,
  CheckoutSummaryOrderTotalType,
  CheckoutSummaryPriceType,
  ConsentType,
  PaymentOptionType,
  ShippingOptionType,
  OrderSummaryType,
  AddressType,
  GetCheckoutOptions,
} from '@geins/types';
export { PaymentOptionCheckoutType } from '@geins/types';

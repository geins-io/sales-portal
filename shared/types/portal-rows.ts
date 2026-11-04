import type { LineConfigurationSummary, PriceType } from './commerce';

/** A single order/quotation line item, normalised for the mobile rows sheet. */
export interface PortalItemRow {
  key: string;
  name: string;
  articleNumber?: string;
  /** The ordered SKU's name, on a product sold in several. */
  skuName?: string;
  quantity: number;
  unitPriceFormatted?: string;
  totalPriceFormatted?: string;
  imageFileName?: string | null;
  imageUrl?: string | null;
  alias?: string | null;
  /** Where the name links instead of the product page: a configured order row's replay. */
  href?: string;
  /** Set on a configured order row. */
  configuration?: LineConfigurationSummary;
  /** A configured row's prices, which its specification totals. */
  unitPrice?: PriceType;
  totalPrice?: PriceType;
}

/** A totals row shown beneath the items in the mobile rows sheet. */
export interface PortalItemTotal {
  label: string;
  value?: string;
  /** Render as the emphasised grand-total row (bold, top border). */
  emphasis?: boolean;
}

/** Which amount a summary row carries; the parts style and test-id it by this. */
export type SummaryRowKey =
  | 'subtotal'
  | 'discount'
  | 'shipping'
  | 'payment-fee'
  | 'tax'
  | 'total'
  | 'total-inc-vat';

/** One row of an order's or a quotation's summary: card, table footer and sheet. */
export interface SummaryRow extends PortalItemTotal {
  key: SummaryRowKey;
}

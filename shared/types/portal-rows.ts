import type { LineConfigurationSummary, PriceType } from './commerce';

/** A single order/quotation line item, normalised for the mobile rows sheet. */
export interface PortalItemRow {
  key: string;
  name: string;
  articleNumber?: string;
  quantity: number;
  unitPriceFormatted?: string;
  totalPriceFormatted?: string;
  imageFileName?: string | null;
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

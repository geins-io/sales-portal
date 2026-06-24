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
}

/** A totals row shown beneath the items in the mobile rows sheet. */
export interface PortalItemTotal {
  label: string;
  value?: string;
  /** Render as the emphasised grand-total row (bold, top border). */
  emphasis?: boolean;
}

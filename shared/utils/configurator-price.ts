import type { PriceType } from '../types/commerce';

// ---------------------------------------------------------------------------
// Reads of a configurator price.
//
// Every price in the configuration document is the Geins `PriceType`, whose
// fields are all optional in the SDK. The fallbacks live here so the page and
// the fixture read an absent amount the same way.
// ---------------------------------------------------------------------------

/** The selling price before VAT, already net of any discount. */
export function exVatAmount(price: PriceType | undefined): number {
  return price?.sellingPriceExVat ?? 0;
}

/** `undefined` lets `formatPrice` fall back to its default currency. */
export function currencyCode(price: PriceType | undefined): string | undefined {
  return price?.currency?.code;
}

/** The selling price with VAT. */
export function incVatAmount(price: PriceType | undefined): number {
  return price?.sellingPriceIncVat ?? 0;
}

/** The VAT the selling price carries. */
export function vatAmount(price: PriceType | undefined): number {
  return price?.vat ?? 0;
}

/**
 * The provider's own VAT amount restated as a whole percentage of the price
 * before VAT. `null` where there is nothing to divide by: included parts
 * arrive at 0.00.
 */
export function vatRatePercent(price: PriceType | undefined): number | null {
  const exVat = price?.sellingPriceExVat;
  const vat = price?.vat;
  if (!exVat || typeof vat !== 'number') return null;
  return Math.round((vat / exVat) * 100);
}

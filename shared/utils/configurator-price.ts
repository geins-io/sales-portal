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

/** The selling price on the side of the buyer's inc/ex VAT choice. */
export function sideAmount(price: PriceType | undefined, inc: boolean): number {
  return inc ? incVatAmount(price) : exVatAmount(price);
}

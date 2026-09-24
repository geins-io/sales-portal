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

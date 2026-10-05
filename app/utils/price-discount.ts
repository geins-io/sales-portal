import type { PriceType } from '#shared/types/commerce';

/** Half an öre (or cent) ex VAT: below it, the two prices format the same. */
const MIN_DISCOUNT_EX_VAT = 0.005;
/** Float subtraction lands just under the boundary: 10000.005 - 10000. */
const FLOAT_TOLERANCE = 1e-9;

/**
 * Whether a price is shown as discounted: the flag, confirmed by the prices.
 *
 * On a CPQ-enabled account the cart can carry the regular price with more
 * decimals than the selling price (86.74170868 against 86.74), which raises
 * the flag with no discount. Compared ex VAT whatever the display mode,
 * because inc VAT that same line differs by a whole öre. A line total takes
 * its quantity: the gap grows with it (0.0017 a unit, 0.0051 on three). A
 * price without both ex-VAT numbers keeps the flag.
 */
export function isShownAsDiscount(
  price:
    | Pick<
        PriceType,
        'isDiscounted' | 'regularPriceExVat' | 'sellingPriceExVat'
      >
    | undefined,
  quantity = 1,
): boolean {
  if (price?.isDiscounted !== true) return false;
  const { regularPriceExVat: regular, sellingPriceExVat: selling } = price;
  if (regular == null || selling == null) return true;
  return regular - selling >= quantity * MIN_DISCOUNT_EX_VAT - FLOAT_TOLERANCE;
}

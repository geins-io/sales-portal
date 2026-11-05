import { formatPrice } from '#shared/types/commerce';

/** Writes one amount, from its number, with Geins' own string as the fallback. */
export type AmountWriter = (
  value: number | null | undefined,
  geins: string | null | undefined,
) => string | undefined;

/**
 * Writes amounts as the SDK writes the order page's: from the number, with
 * `Intl` in the currency. Geins' own string has no decimals on a whole amount
 * ("4 kr"), the order page's has ("4,00 kr"). Without a number or a currency,
 * Geins' string stands.
 */
export function amountWriter(
  currency: string | null | undefined,
  locale: string,
): AmountWriter {
  return (value, geins) =>
    value != null && currency
      ? formatPrice(value, currency, locale)
      : (geins ?? undefined);
}

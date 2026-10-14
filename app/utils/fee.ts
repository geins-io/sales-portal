/**
 * A fee to show, on one side of the VAT choice: the formatted string when the
 * amount is above 0, otherwise nothing. Decided on the number, shown formatted.
 */
export function feeOf(
  amount: number | null | undefined,
  formatted: string | null | undefined,
): string | undefined {
  return (amount ?? 0) > 0 ? formatted || undefined : undefined;
}

/**
 * Human-readable measurements from the values Geins actually stores.
 *
 * Geins keeps dimensions in millimetres and weight in grams (verified against
 * live data 2026-09-13: a 3 m cable has `length: 3000`). Printed raw that
 * reads "3000 mm", which is accurate and awkward, so a value scales up once
 * the larger unit is the one a person would say out loud.
 *
 * Scaling is lossless: three decimals covers every whole millimetre and gram,
 * and Intl drops the trailing zeros, so 3000 renders "3 m" while 1234 renders
 * "1,234 m" rather than a rounded "1,23 m".
 */
const SCALE_AT = 1000;
const MAX_FRACTION_DIGITS = 3;

function formatNumber(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: MAX_FRACTION_DIGITS,
    }).format(value);
  } catch {
    // An invalid locale tag makes Intl throw. A measurement is worth showing
    // even when the tag is unusable, so fall back to the plain representation
    // rather than dropping the row.
    return String(value);
  }
}

function scaled(value: number, locale: string, small: string, large: string) {
  return value >= SCALE_AT
    ? `${formatNumber(value / SCALE_AT, locale)} ${large}`
    : `${formatNumber(value, locale)} ${small}`;
}

/** Millimetres, shown in metres from 1000 mm up. */
export function formatLength(millimetres: number, locale: string): string {
  return scaled(millimetres, locale, 'mm', 'm');
}

/** Grams, shown in kilograms from 1000 g up. */
export function formatWeight(grams: number, locale: string): string {
  return scaled(grams, locale, 'g', 'kg');
}

import {
  converter,
  modeHsl,
  modeOklab,
  modeOklch,
  modeRgb,
  parse,
  useMode,
} from 'culori/fn';

// Coerces any CSS color string the merchant admin can produce to OKLCH,
// preserving alpha exactly as the admin entered it. The merchant admin's
// saved value is the truth; the storefront renders what was saved.
//
// Output format:
//   - alpha === 1 or alpha undefined -> `oklch(L C H)`           (3 components)
//   - alpha < 1                      -> `oklch(L C H / A)`       (4 components)
//
// Derivation (see `deriveThemeColors` in `theme.ts`) is opaque by design:
// semantic shade math over a translucent base is undefined, so derived
// shades are emitted as 3-component OKLCH even when the base carries alpha.

// rgb -> oklab -> oklch is the conversion path; modeRgb's bundled parsers
// cover hex, rgb(), rgba(), and named CSS colors.
useMode(modeRgb);
useMode(modeHsl);
useMode(modeOklab);
useMode(modeOklch);

const toOklch = converter('oklch');

// Defense-in-depth: any legitimate CSS color string fits well under 256 chars.
// Caps input cost (string copies during parse) for pathological payloads.
const MAX_RAW_LENGTH = 256;

export interface CoercedColor {
  value: string;
}

// Default NaN to 0 so achromatic hues (white/black/grey) don't leak `NaN`.
function round(value: number | undefined, decimals: number): number {
  if (value === undefined || Number.isNaN(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function coerceToOklch(raw: string): CoercedColor | null {
  if (raw.length > MAX_RAW_LENGTH) return null;
  if (raw.trim().length === 0) return null;

  const parsed = parse(raw);
  if (!parsed) return null;

  const oklch = toOklch(parsed);
  if (!oklch) return null;

  const l = round(oklch.l, 4);
  const c = round(oklch.c, 4);
  const h = round(oklch.h, 2);

  // Preserve alpha verbatim. Only emit the 4-component form when the admin
  // actually picked a translucent color; opaque colors stay in the canonical
  // 3-component form so downstream consumers that don't care about alpha
  // don't change shape.
  const hasAlpha = typeof oklch.alpha === 'number' && oklch.alpha < 1;
  if (hasAlpha) {
    const a = round(oklch.alpha, 2);
    return { value: `oklch(${l} ${c} ${h} / ${a})` };
  }
  return { value: `oklch(${l} ${c} ${h})` };
}

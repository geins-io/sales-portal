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
const toRgb = converter('rgb');

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

// Converts a CSS color to a Safari-safe sRGB form. Older Safari (< 15.4)
// cannot parse `oklch()`, so a custom property set to an oklch value
// becomes invalid-at-computed-value-time and any `var(--x)` consuming it
// renders nothing (the reported "store-settings colors don't show in
// Safari" bug). We emit the sRGB equivalent instead: `#rrggbb` for opaque
// colors, legacy-comma `rgba(r, g, b, a)` for translucent ones (both are
// universally supported, including the modern-syntax-shy old Safari).
//
// Non-oklch inputs pass through verbatim: hex/rgb()/named are already
// safe, and `var(--ref)` references MUST NOT be rewritten — they resolve
// to whichever (already-converted) property they point at.
export function toSafariSafeColor(value: string): string {
  const trimmed = value.trim();
  if (!/^oklch\(/i.test(trimmed)) return value;

  const parsed = parse(trimmed);
  if (!parsed) return value;
  const rgb = toRgb(parsed);
  if (!rgb) return value;

  // Per-channel clamp to the sRGB byte range. Brand colors are low-chroma
  // and in-gamut; clamping matches what the browser does on display anyway.
  const channel = (n: number | undefined): number =>
    Math.max(0, Math.min(255, Math.round((n ?? 0) * 255)));
  const r = channel(rgb.r);
  const g = channel(rgb.g);
  const b = channel(rgb.b);

  const hasAlpha = typeof rgb.alpha === 'number' && rgb.alpha < 1;
  if (hasAlpha) {
    return `rgba(${r}, ${g}, ${b}, ${round(rgb.alpha, 3)})`;
  }
  const hex = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

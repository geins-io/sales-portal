import {
  converter,
  modeHsl,
  modeOklab,
  modeOklch,
  modeRgb,
  parse,
  useMode,
} from 'culori/fn';

import { logger } from './logger';

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

// WHY: prevents log spam when a tenant has many alpha-stripped colors and the
// config is re-parsed (e.g. on SWR refresh). Without this, an 8-surface tenant
// with rgba() everywhere emits 8 warns per parse, multiplied by every refresh.
const warnedAlphaRaw = new Set<string>();

/**
 * Test-only: reset the alpha-dedupe set between specs. Production code should
 * never call this; the module-level Set is intentionally process-lifetime.
 */
export function __resetColorCoercionForTests(): void {
  warnedAlphaRaw.clear();
}

export interface CoercedColor {
  value: string;
  droppedAlpha: boolean;
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

  const droppedAlpha = typeof oklch.alpha === 'number' && oklch.alpha < 1;
  const value = `oklch(${l} ${c} ${h})`;

  if (droppedAlpha && !warnedAlphaRaw.has(raw)) {
    warnedAlphaRaw.add(raw);
    logger.warn('color-coerce: alpha dropped', {
      raw,
      parsed: value,
      droppedAlpha: true,
    });
  }

  return { value, droppedAlpha };
}

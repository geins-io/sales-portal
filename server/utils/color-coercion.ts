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

  if (droppedAlpha) {
    logger.warn('color-coerce: alpha dropped', {
      raw,
      parsed: value,
      droppedAlpha: true,
    });
  }

  return { value, droppedAlpha };
}

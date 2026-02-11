import type { ThemeColors } from '../schemas/store-settings';

/**
 * Parse an OKLCH color string into its L, C, H components.
 */
export function parseOklch(color: string): { l: number; c: number; h: number } {
  const match = color.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/);
  if (!match) {
    return { l: 0.5, c: 0, h: 0 };
  }
  return {
    l: parseFloat(match[1]!),
    c: parseFloat(match[2]!),
    h: parseFloat(match[3]!),
  };
}

/**
 * Format L, C, H components back into an OKLCH color string.
 */
export function formatOklch(l: number, c: number, h: number): string {
  return `oklch(${clamp(l, 0, 1).toFixed(3)} ${clamp(c, 0, 0.4).toFixed(3)} ${normalizeHue(h).toFixed(3)})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

/**
 * Required color keys — all 32 color fields after derivation.
 */
export type FullThemeColors = Required<{
  [K in keyof ThemeColors]: string;
}>;

/**
 * Derives all 26 optional colors from 6 core required colors.
 * API-provided non-null values are preserved; only null/undefined are derived.
 *
 * Derivation rules follow shadcn/ui conventions.
 */
export function deriveThemeColors(colors: ThemeColors): FullThemeColors {
  const { l: bgL, c: bgC, h: bgH } = parseOklch(colors.background);
  const { l: fgL, c: fgC, h: fgH } = parseOklch(colors.foreground);
  const { l: priL, c: priC, h: priH } = parseOklch(colors.primary);

  // Helper: pick provided value or derive
  const pick = (value: string | null | undefined, fallback: string): string =>
    value ?? fallback;

  // Derived muted: slightly dimmed background
  const mutedBg = formatOklch(
    bgL > 0.5 ? bgL - 0.03 : bgL + 0.03,
    Math.max(bgC, 0.001),
    bgH || 286.375,
  );
  // Derived muted foreground: dimmed foreground
  const mutedFg = formatOklch(
    fgL > 0.5 ? fgL - 0.1 : fgL + 0.41,
    Math.max(fgC, 0.016),
    fgH || 285.938,
  );

  // Derived border: between muted and background
  const borderColor = formatOklch(
    bgL > 0.5 ? bgL - 0.078 : bgL + 0.078,
    Math.max(bgC, 0.004),
    bgH || 286.32,
  );

  // Derived ring: mid-lightness neutral or primary-based
  const ringColor =
    priC > 0.05
      ? formatOklch(Math.min(priL + 0.22, 0.95), priC, priH)
      : formatOklch(0.708, 0, 0);

  // Sidebar: slightly off-background
  const sidebarBg = formatOklch(
    bgL > 0.5 ? bgL - 0.015 : bgL + 0.015,
    bgC,
    bgH,
  );

  // Chart colors: hue rotations around primary
  const chart1 = formatOklch(
    clamp(priL + 0.15, 0, 1),
    Math.min(priC * 0.8, 0.25),
    normalizeHue(priH + 15),
  );
  const chart2 = formatOklch(
    clamp(priL + 0.05, 0, 1),
    Math.min(priC * 0.9, 0.25),
    normalizeHue(priH - 10),
  );
  const chart3 = formatOklch(priL, Math.min(priC, 0.25), priH);
  const chart4 = formatOklch(
    clamp(priL - 0.07, 0, 1),
    Math.min(priC * 0.85, 0.25),
    normalizeHue(priH - 5),
  );
  const chart5 = formatOklch(
    clamp(priL - 0.13, 0, 1),
    Math.min(priC * 0.75, 0.25),
    normalizeHue(priH - 15),
  );

  return {
    // Core (always provided)
    primary: colors.primary,
    primaryForeground: colors.primaryForeground,
    secondary: colors.secondary,
    secondaryForeground: colors.secondaryForeground,
    background: colors.background,
    foreground: colors.foreground,

    // Derived with fallbacks
    card: pick(colors.card, colors.background),
    cardForeground: pick(colors.cardForeground, colors.foreground),
    popover: pick(colors.popover, colors.background),
    popoverForeground: pick(colors.popoverForeground, colors.foreground),
    muted: pick(colors.muted, mutedBg),
    mutedForeground: pick(colors.mutedForeground, mutedFg),
    accent: pick(colors.accent, colors.secondary),
    accentForeground: pick(colors.accentForeground, colors.secondaryForeground),
    destructive: pick(colors.destructive, 'oklch(0.577 0.245 27.325)'),
    destructiveForeground: pick(
      colors.destructiveForeground,
      'oklch(0.985 0 0)',
    ),
    border: pick(colors.border, borderColor),
    input: pick(colors.input, borderColor),
    ring: pick(colors.ring, ringColor),
    chart1: pick(colors.chart1, chart1),
    chart2: pick(colors.chart2, chart2),
    chart3: pick(colors.chart3, chart3),
    chart4: pick(colors.chart4, chart4),
    chart5: pick(colors.chart5, chart5),
    sidebar: pick(colors.sidebar, sidebarBg),
    sidebarForeground: pick(colors.sidebarForeground, colors.foreground),
    sidebarPrimary: pick(colors.sidebarPrimary, colors.primary),
    sidebarPrimaryForeground: pick(
      colors.sidebarPrimaryForeground,
      colors.primaryForeground,
    ),
    sidebarAccent: pick(colors.sidebarAccent, colors.secondary),
    sidebarAccentForeground: pick(
      colors.sidebarAccentForeground,
      colors.secondaryForeground,
    ),
    sidebarBorder: pick(colors.sidebarBorder, borderColor),
    sidebarRing: pick(colors.sidebarRing, ringColor),
  };
}

import type { TenantConfig } from '#shared/types/tenant-config';
import type { ThemeColors, ThemeTypography } from '../schemas/store-settings';
import { deriveThemeColors, type FullThemeColors } from './theme';
import { escapeCssString } from './sanitize';

/**
 * Default 6 core colors (shadcn zinc theme)
 */
export const DEFAULT_CORE_COLORS: Pick<
  ThemeColors,
  | 'primary'
  | 'primaryForeground'
  | 'secondary'
  | 'secondaryForeground'
  | 'background'
  | 'foreground'
> = {
  primary: 'oklch(0.205 0 0)',
  primaryForeground: 'oklch(0.985 0 0)',
  secondary: 'oklch(0.97 0 0)',
  secondaryForeground: 'oklch(0.205 0 0)',
  background: 'oklch(1 0 0)',
  foreground: 'oklch(0.145 0 0)',
};

/**
 * CSS property name mapping for all 32 theme color keys
 */
const COLOR_CSS_MAP: Record<keyof FullThemeColors, string> = {
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  background: '--background',
  foreground: '--foreground',
  card: '--card',
  cardForeground: '--card-foreground',
  popover: '--popover',
  popoverForeground: '--popover-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  destructive: '--destructive',
  destructiveForeground: '--destructive-foreground',
  border: '--border',
  input: '--input',
  ring: '--ring',
  chart1: '--chart-1',
  chart2: '--chart-2',
  chart3: '--chart-3',
  chart4: '--chart-4',
  chart5: '--chart-5',
  sidebar: '--sidebar',
  sidebarForeground: '--sidebar-foreground',
  sidebarPrimary: '--sidebar-primary',
  sidebarPrimaryForeground: '--sidebar-primary-foreground',
  sidebarAccent: '--sidebar-accent',
  sidebarAccentForeground: '--sidebar-accent-foreground',
  sidebarBorder: '--sidebar-border',
  sidebarRing: '--sidebar-ring',
};

/**
 * Generates CSS custom properties from a full set of derived colors
 */
function generateColorCss(
  colors: FullThemeColors,
  indent: string = '  ',
): string {
  const lines: string[] = [];
  for (const [key, cssVar] of Object.entries(COLOR_CSS_MAP)) {
    const value = colors[key as keyof FullThemeColors];
    if (value) {
      lines.push(`${indent}${cssVar}: ${value};`);
    }
  }
  return lines.join('\n');
}

/**
 * Generates the base radius CSS variable.
 * Tailwind's @theme inline handles sm/md/lg/xl via calc(var(--radius) - Npx).
 */
function generateRadiusCss(radius: string, indent: string = '  '): string {
  return `${indent}--radius: ${radius};`;
}

/**
 * Generates font-family CSS custom properties from typography config.
 * Emits --font-family, --heading-font-family, --mono-font-family.
 */
export function generateFontCss(
  typography?: ThemeTypography | null,
  indent: string = '  ',
): string {
  if (!typography) return '';

  const lines: string[] = [];

  if (typography.fontFamily) {
    const safe = escapeCssString(typography.fontFamily);
    lines.push(
      `${indent}--font-family: '${safe}', ui-sans-serif, system-ui, sans-serif;`,
    );
  }

  const headingFamily = typography.headingFontFamily ?? typography.fontFamily;
  if (headingFamily) {
    const safe = escapeCssString(headingFamily);
    lines.push(
      `${indent}--heading-font-family: '${safe}', ui-sans-serif, system-ui, sans-serif;`,
    );
  }

  if (typography.monoFontFamily) {
    const safe = escapeCssString(typography.monoFontFamily);
    lines.push(
      `${indent}--mono-font-family: '${safe}', ui-monospace, 'SFMono-Regular', monospace;`,
    );
  }

  return lines.join('\n');
}

/**
 * Generates CSS custom properties from override CSS map
 */
/** Matches valid CSS custom property names (--foo-bar) or standard properties (font-size). */
const VALID_CSS_PROP = /^--?[a-zA-Z][a-zA-Z0-9-]*$/;

export function generateOverrideCss(
  css?: Record<string, string> | null,
  indent: string = '  ',
): string {
  if (!css) return '';
  return Object.entries(css)
    .filter(([prop]) => VALID_CSS_PROP.test(prop))
    .map(([prop, value]) => `${indent}${prop}: ${value};`)
    .join('\n');
}

/**
 * Generates a hash string from a theme object for comparison.
 * Used to determine if CSS needs to be regenerated.
 */
export function generateThemeHash(theme: TenantConfig['theme']): string {
  const sortedStringify = (obj: unknown): string => {
    return JSON.stringify(obj, (_, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value)
          .sort()
          .reduce(
            (sorted, key) => {
              sorted[key] = value[key];
              return sorted;
            },
            {} as Record<string, unknown>,
          );
      }
      return value;
    });
  };
  return sortedStringify(theme);
}

/**
 * Generates complete CSS for a tenant theme.
 * Colors are the full 32-color set (already derived), radius generates variants,
 * and override CSS vars are appended.
 */
export function generateTenantCss(
  themeName: string,
  derivedColors: FullThemeColors,
  radius?: string | null,
  overrideCss?: Record<string, string> | null,
  typography?: ThemeTypography | null,
): string {
  const lines: string[] = [];

  lines.push(`[data-theme='${themeName}'] {`);
  lines.push(generateColorCss(derivedColors));

  if (radius) {
    lines.push(generateRadiusCss(radius));
  }

  const fontCss = generateFontCss(typography);
  if (fontCss) {
    lines.push(fontCss);
  }

  const overrides = generateOverrideCss(overrideCss);
  if (overrides) {
    lines.push(overrides);
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Creates a default theme for development/auto-created tenants
 */
export function createDefaultTheme(tenantId: string): TenantConfig['theme'] {
  return {
    name: tenantId.toLowerCase(),
    displayName: tenantId,
    colors: {
      ...DEFAULT_CORE_COLORS,
      card: null,
      cardForeground: null,
      popover: null,
      popoverForeground: null,
      muted: null,
      mutedForeground: null,
      accent: null,
      accentForeground: null,
      destructive: null,
      destructiveForeground: null,
      border: null,
      input: null,
      ring: null,
      chart1: null,
      chart2: null,
      chart3: null,
      chart4: null,
      chart5: null,
      sidebar: null,
      sidebarForeground: null,
      sidebarPrimary: null,
      sidebarPrimaryForeground: null,
      sidebarAccent: null,
      sidebarAccentForeground: null,
      sidebarBorder: null,
      sidebarRing: null,
    },
    radius: '0.625rem',
  };
}

/**
 * Merges a base theme with partial theme updates.
 */
export function mergeThemes(
  base: TenantConfig['theme'],
  updates?: Partial<TenantConfig['theme']>,
): TenantConfig['theme'] {
  if (!updates) return base;
  return {
    ...base,
    ...updates,
    colors: { ...base.colors, ...updates.colors },
    typography:
      updates.typography !== undefined ? updates.typography : base.typography,
  };
}

/**
 * Derives full 32-color set and generates complete tenant CSS + theme hash.
 * Convenience wrapper used by CRUD operations to avoid repeating color derivation.
 */
export function buildDerivedTheme(
  theme: TenantConfig['theme'],
  overrideCss?: Record<string, string> | null,
): {
  themeWithDerived: TenantConfig['theme'] & { colors: Record<string, string> };
  css: string;
  themeHash: string;
} {
  const derivedColors = deriveThemeColors(theme.colors as ThemeColors);
  const themeWithDerived = {
    ...theme,
    colors: derivedColors as Record<string, string>,
  };
  const themeHash = generateThemeHash(themeWithDerived);
  const css = generateTenantCss(
    themeWithDerived.name,
    derivedColors,
    themeWithDerived.radius,
    overrideCss,
    themeWithDerived.typography,
  );
  return { themeWithDerived, css, themeHash };
}

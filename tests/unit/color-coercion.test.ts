import { describe, expect, it } from 'vitest';

import {
  coerceToOklch,
  toSafariSafeColor,
} from '../../server/utils/color-coercion';

// Accepts both 3-component (opaque) and 4-component (with alpha) forms.
const oklchPattern = /^oklch\([\d.]+ [\d.]+ [\d.]+( \/ [\d.]+)?\)$/;
const opaquePattern = /^oklch\([\d.]+ [\d.]+ [\d.]+\)$/;
const withAlphaPattern = /^oklch\([\d.]+ [\d.]+ [\d.]+ \/ [\d.]+\)$/;

describe('coerceToOklch', () => {
  it('parses 6-digit hex `#eae8dc` as opaque (no alpha slot)', () => {
    const result = coerceToOklch('#eae8dc');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(opaquePattern);
  });

  it('parses 8-digit hex `#eae8dc99` and preserves alpha (admin value is truth)', () => {
    const result = coerceToOklch('#eae8dc99');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(withAlphaPattern);
    // 0x99 / 0xff ~= 0.6
    expect(result!.value).toContain('/ 0.6');
  });

  it('parses 3-digit hex `#abc` as opaque', () => {
    const result = coerceToOklch('#abc');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(opaquePattern);
  });

  it('parses `rgb(255, 0, 0)` as opaque', () => {
    const result = coerceToOklch('rgb(255, 0, 0)');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(opaquePattern);
  });

  it('parses `rgba(255, 0, 0, 0.5)` and preserves the alpha channel', () => {
    const result = coerceToOklch('rgba(255, 0, 0, 0.5)');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(withAlphaPattern);
    expect(result!.value).toContain('/ 0.5');
  });

  it('parses `hsla(120, 50%, 50%, 0.5)` and preserves alpha', () => {
    const result = coerceToOklch('hsla(120, 50%, 50%, 0.5)');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(withAlphaPattern);
    expect(result!.value).toContain('/ 0.5');
  });

  it('coerces named `transparent` to alpha-zero OKLCH (transparent is a legitimate color, render it as the admin asked)', () => {
    const result = coerceToOklch('transparent');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(withAlphaPattern);
    expect(result!.value).toContain('/ 0');
  });

  it('returns null for inputs longer than 256 chars (defense-in-depth)', () => {
    expect(coerceToOklch('a'.repeat(257))).toBeNull();
  });

  it('parses `hsl(120, 50%, 50%)` as opaque', () => {
    const result = coerceToOklch('hsl(120, 50%, 50%)');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(opaquePattern);
  });

  it('passes through `oklch(0.5 0.2 200)` (opaque)', () => {
    const result = coerceToOklch('oklch(0.5 0.2 200)');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(opaquePattern);
  });

  it('passes through `oklch(0.5 0.2 200 / 0.5)` and preserves alpha', () => {
    const result = coerceToOklch('oklch(0.5 0.2 200 / 0.5)');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(withAlphaPattern);
    expect(result!.value).toContain('/ 0.5');
  });

  it('parses named color `white` without leaking NaN on the achromatic hue', () => {
    const result = coerceToOklch('white');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(opaquePattern);
    expect(result!.value).not.toContain('NaN');
  });

  it('parses named color `rebeccapurple`', () => {
    const result = coerceToOklch('rebeccapurple');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(opaquePattern);
  });

  it('returns null for `not-a-color`', () => {
    expect(coerceToOklch('not-a-color')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(coerceToOklch('')).toBeNull();
  });
});

describe('CoercedColorSchema integration', () => {
  it('succeeds on `#eae8dc99` and emits the 4-component oklch form (alpha preserved)', async () => {
    const { ThemeColorsSchema } =
      await import('../../server/schemas/store-settings');
    const result = ThemeColorsSchema.safeParse({
      primary: '#eae8dc99',
      primaryForeground: '#ffffff',
      secondary: '#000000',
      secondaryForeground: '#ffffff',
      background: '#ffffff',
      foreground: '#000000',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.primary).toMatch(withAlphaPattern);
    }
  });

  it('fails with a Zod issue on `garbage` input', async () => {
    const { ThemeColorsSchema } =
      await import('../../server/schemas/store-settings');
    const result = ThemeColorsSchema.safeParse({
      primary: 'garbage',
      primaryForeground: '#ffffff',
      secondary: '#000000',
      secondaryForeground: '#ffffff',
      background: '#ffffff',
      foreground: '#000000',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
      expect(result.error.issues[0]?.path).toEqual(['primary']);
    }
  });

  it('preserves the opaque output for solid colors (no alpha slot)', async () => {
    const { ThemeColorsSchema } =
      await import('../../server/schemas/store-settings');
    const result = ThemeColorsSchema.safeParse({
      primary: '#eae8dc',
      primaryForeground: '#ffffff',
      secondary: '#000000',
      secondaryForeground: '#ffffff',
      background: '#ffffff',
      foreground: '#000000',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.primary).toMatch(opaquePattern);
      expect(result.data.primary).not.toContain('/');
    }
  });
});

// Future-proofing: ensure both forms match the broad oklchPattern that the
// salvager-side tests use.
describe('oklchPattern shape', () => {
  it('matches both 3- and 4-component forms', () => {
    expect('oklch(0.5 0.1 200)').toMatch(oklchPattern);
    expect('oklch(0.5 0.1 200 / 0.5)').toMatch(oklchPattern);
  });
});

describe('toSafariSafeColor', () => {
  it('converts opaque oklch() to sRGB hex', () => {
    expect(toSafariSafeColor('oklch(0.7 0.1 20)')).toBe('#d68585');
    expect(toSafariSafeColor('oklch(0.205 0 0)')).toBe('#171717');
    expect(toSafariSafeColor('oklch(0.5 0.1 200)')).toBe('#00747a');
  });

  it('converts translucent oklch() to legacy-comma rgba()', () => {
    expect(toSafariSafeColor('oklch(0.5 0.16 175 / 0.6)')).toBe(
      'rgba(0, 126, 94, 0.6)',
    );
  });

  it('passes var() references through verbatim (never rewrite a reference)', () => {
    expect(toSafariSafeColor('var(--primary)')).toBe('var(--primary)');
    expect(toSafariSafeColor('var(--button-background)')).toBe(
      'var(--button-background)',
    );
  });

  it('passes already-sRGB values (hex/rgb/named) through unchanged', () => {
    expect(toSafariSafeColor('#f084ec')).toBe('#f084ec');
    expect(toSafariSafeColor('rgb(10, 20, 30)')).toBe('rgb(10, 20, 30)');
    expect(toSafariSafeColor('white')).toBe('white');
  });

  it('never emits oklch() for any oklch input', () => {
    for (const v of ['oklch(0.5 0.1 200)', 'oklch(0.9 0.2 50 / 0.4)']) {
      expect(toSafariSafeColor(v)).not.toMatch(/oklch\(/);
    }
  });
});

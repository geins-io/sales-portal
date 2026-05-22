import { beforeEach, describe, expect, it, vi } from 'vitest';

import { coerceToOklch } from '../../server/utils/color-coercion';
import { logger } from '../../server/utils/logger';

const oklchPattern = /^oklch\([\d.]+ [\d.]+ [\d.]+\)$/;

describe('coerceToOklch', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  it('parses 6-digit hex `#eae8dc` into a valid oklch string', () => {
    const result = coerceToOklch('#eae8dc');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(oklchPattern);
    expect(result!.droppedAlpha).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('parses 8-digit hex `#eae8dc99`, strips alpha and warns', () => {
    const result = coerceToOklch('#eae8dc99');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(oklchPattern);
    expect(result!.droppedAlpha).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'color-coerce: alpha dropped',
      expect.objectContaining({ raw: '#eae8dc99', droppedAlpha: true }),
    );
  });

  it('parses 3-digit hex `#abc`', () => {
    const result = coerceToOklch('#abc');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(oklchPattern);
    expect(result!.droppedAlpha).toBe(false);
  });

  it('parses `rgb(255, 0, 0)`', () => {
    const result = coerceToOklch('rgb(255, 0, 0)');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(oklchPattern);
    expect(result!.droppedAlpha).toBe(false);
  });

  it('parses `rgba(255, 0, 0, 0.5)` and strips alpha', () => {
    const result = coerceToOklch('rgba(255, 0, 0, 0.5)');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(oklchPattern);
    expect(result!.droppedAlpha).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('parses `hsl(120, 50%, 50%)`', () => {
    const result = coerceToOklch('hsl(120, 50%, 50%)');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(oklchPattern);
    expect(result!.droppedAlpha).toBe(false);
  });

  it('passes through `oklch(0.5 0.2 200)` (reformatted)', () => {
    const result = coerceToOklch('oklch(0.5 0.2 200)');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(oklchPattern);
    expect(result!.droppedAlpha).toBe(false);
  });

  it('handles `oklch(0.5 0.2 200 / 0.5)` and strips alpha', () => {
    const result = coerceToOklch('oklch(0.5 0.2 200 / 0.5)');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(oklchPattern);
    expect(result!.droppedAlpha).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('parses named color `white`', () => {
    const result = coerceToOklch('white');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(oklchPattern);
    // Achromatic hue must not leak NaN.
    expect(result!.value).not.toContain('NaN');
  });

  it('parses named color `rebeccapurple`', () => {
    const result = coerceToOklch('rebeccapurple');
    expect(result).not.toBeNull();
    expect(result!.value).toMatch(oklchPattern);
  });

  it('returns null for `not-a-color`', () => {
    expect(coerceToOklch('not-a-color')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(coerceToOklch('')).toBeNull();
  });
});

describe('CoercedColorSchema integration', () => {
  it('succeeds on `#eae8dc99` and yields an oklch string', async () => {
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
      expect(result.data.primary).toMatch(oklchPattern);
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
});

import { describe, it, expect } from 'vitest';
import { ThemeColorsSchema } from '../../../../server/schemas/store-settings';

const baseCore = {
  primary: 'oklch(0.5 0.1 200)',
  primaryForeground: 'oklch(0.9 0 0)',
  secondary: 'oklch(0.8 0 0)',
  secondaryForeground: 'oklch(0.2 0 0)',
  background: 'oklch(1 0 0)',
  foreground: 'oklch(0.1 0 0)',
};

describe('ThemeColorsSchema topBarBackground', () => {
  it('accepts a 6-digit lowercase hex value', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      topBarBackground: '#f084ec',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a 6-digit uppercase hex value', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      topBarBackground: '#F084EC',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid OKLCH value', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      topBarBackground: 'oklch(0.7 0.1 20)',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a 3-digit hex shorthand', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      topBarBackground: '#fff',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an 8-digit hex (alpha channel)', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      topBarBackground: '#ff00aabb',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a CSS named color', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      topBarBackground: 'red',
    });
    expect(result.success).toBe(false);
  });

  it('treats topBarBackground as optional', () => {
    const result = ThemeColorsSchema.safeParse({ ...baseCore });
    expect(result.success).toBe(true);
  });
});

describe('ThemeColorsSchema footerBackground', () => {
  it('accepts a 6-digit lowercase hex value', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      footerBackground: '#d241b3',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a 6-digit uppercase hex value', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      footerBackground: '#D241B3',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid OKLCH value', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      footerBackground: 'oklch(0.6 0.2 350)',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a 3-digit hex shorthand', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      footerBackground: '#fff',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an 8-digit hex (alpha channel)', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      footerBackground: '#ff00aabb',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a CSS named color', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      footerBackground: 'blue',
    });
    expect(result.success).toBe(false);
  });

  it('treats footerBackground as optional', () => {
    const result = ThemeColorsSchema.safeParse({ ...baseCore });
    expect(result.success).toBe(true);
  });
});

describe('ThemeColorsSchema strict 32 colors regression', () => {
  it('still rejects hex on the standard primary color', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      primary: '#ff0000',
    });
    expect(result.success).toBe(false);
  });

  it('still rejects hex on an optional standard color (destructive)', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      destructive: '#ff0000',
    });
    expect(result.success).toBe(false);
  });
});

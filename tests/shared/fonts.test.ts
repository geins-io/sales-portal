import { describe, it, expect } from 'vitest';
import { buildGoogleFontsUrl } from '../../shared/utils/fonts';

describe('buildGoogleFontsUrl', () => {
  it('returns null for null typography', () => {
    expect(buildGoogleFontsUrl(null)).toBeNull();
  });

  it('returns null for undefined typography', () => {
    expect(buildGoogleFontsUrl(undefined)).toBeNull();
  });

  it('returns null when no font families are set', () => {
    expect(buildGoogleFontsUrl({ fontFamily: '' })).toBeNull();
  });

  it('builds URL for a single font family', () => {
    const result = buildGoogleFontsUrl({ fontFamily: 'Inter' });
    expect(result).not.toBeNull();
    const url = new URL(result!);
    expect(url.origin).toBe('https://fonts.googleapis.com');
    expect(url.pathname).toBe('/css2');
    expect(url.searchParams.getAll('family')).toEqual([
      'Inter:wght@300;400;500;600;700',
    ]);
    expect(url.searchParams.get('display')).toBe('swap');
  });

  it('builds URL for multiple font families', () => {
    const result = buildGoogleFontsUrl({
      fontFamily: 'Inter',
      headingFontFamily: 'Playfair Display',
      monoFontFamily: 'Fira Code',
    });
    expect(result).not.toBeNull();
    const url = new URL(result!);
    const families = url.searchParams.getAll('family');
    expect(families).toHaveLength(3);
    expect(families).toContain('Inter:wght@300;400;500;600;700');
    expect(families).toContain('Playfair Display:wght@300;400;500;600;700');
    expect(families).toContain('Fira Code:wght@300;400;500;600;700');
  });

  it('deduplicates identical families', () => {
    const result = buildGoogleFontsUrl({
      fontFamily: 'Inter',
      headingFontFamily: 'Inter',
    });
    expect(result).not.toBeNull();
    const url = new URL(result!);
    expect(url.searchParams.getAll('family')).toHaveLength(1);
  });

  it('properly encodes spaces in font names', () => {
    const result = buildGoogleFontsUrl({ fontFamily: 'Open Sans' });
    expect(result).not.toBeNull();
    // URL constructor encodes spaces as +
    expect(result).toContain('Open+Sans');
  });

  it('properly encodes special characters', () => {
    const result = buildGoogleFontsUrl({ fontFamily: 'Noto Sans JP' });
    expect(result).not.toBeNull();
    // Should be a valid URL
    expect(() => new URL(result!)).not.toThrow();
  });

  it('produces a valid parseable URL', () => {
    const result = buildGoogleFontsUrl({
      fontFamily: 'Roboto',
      headingFontFamily: 'Merriweather',
    });
    expect(result).not.toBeNull();
    expect(() => new URL(result!)).not.toThrow();
  });

  it('skips null heading and mono families', () => {
    const result = buildGoogleFontsUrl({
      fontFamily: 'Inter',
      headingFontFamily: null,
      monoFontFamily: null,
    });
    expect(result).not.toBeNull();
    const url = new URL(result!);
    expect(url.searchParams.getAll('family')).toHaveLength(1);
  });
});

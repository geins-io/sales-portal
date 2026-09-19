import { describe, expect, it } from 'vitest';
import { formatLength, formatWeight } from '~/utils/measurements';

// Geins stores dimensions in millimetres and weight in grams (verified against
// live data 2026-09-13: a 3 m cable has length 3000). Rendering that raw makes
// a cable read "3000 mm", so values scale up at the point the bigger unit
// starts being the natural one to say out loud.
describe('formatLength', () => {
  it('keeps small values in millimetres', () => {
    expect(formatLength(120, 'sv-SE')).toBe('120 mm');
    expect(formatLength(25, 'sv-SE')).toBe('25 mm');
  });

  it('scales to metres from 1000 mm', () => {
    expect(formatLength(1000, 'sv-SE')).toBe('1 m');
    expect(formatLength(3000, 'sv-SE')).toBe('3 m');
    expect(formatLength(10000, 'sv-SE')).toBe('10 m');
  });

  it('stays in millimetres just below the threshold', () => {
    expect(formatLength(999, 'sv-SE')).toBe('999 mm');
  });

  it('keeps the exact value rather than rounding it away', () => {
    // 1234 mm is 1.234 m exactly — three decimals is lossless for millimetres,
    // so scaling never silently discards a measurement.
    expect(formatLength(1234, 'sv-SE')).toBe('1,234 m');
    expect(formatLength(1800, 'sv-SE')).toBe('1,8 m');
  });

  it('uses the viewer locale decimal separator', () => {
    expect(formatLength(1500, 'sv-SE')).toBe('1,5 m');
    expect(formatLength(1500, 'en-GB')).toBe('1.5 m');
  });

  it('falls back to a plain format for an unusable locale', () => {
    expect(formatLength(1500, 'not a locale')).toBe('1.5 m');
  });
});

describe('formatWeight', () => {
  it('keeps small values in grams', () => {
    expect(formatWeight(60, 'sv-SE')).toBe('60 g');
    expect(formatWeight(999, 'sv-SE')).toBe('999 g');
  });

  it('scales to kilograms from 1000 g', () => {
    expect(formatWeight(1000, 'sv-SE')).toBe('1 kg');
    expect(formatWeight(2500, 'sv-SE')).toBe('2,5 kg');
    expect(formatWeight(1234, 'sv-SE')).toBe('1,234 kg');
  });
});

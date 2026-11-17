import { describe, it, expect } from 'vitest';
import { toCmsPageAlias } from '../../../server/utils/cms-page-alias';

describe('toCmsPageAlias', () => {
  // Title → alias pairs as Geins published them on a registered tenant.
  it.each([
    ['Ansök om konto', 'ansok-om-konto'],
    ['Villkor', 'villkor'],
    ['Kontaktw', 'kontaktw'],
    ['Images', 'images'],
    ['tom page test', 'tom-page-test'],
  ])('%s → %s, as Geins aliases it', (title, alias) => {
    expect(toCmsPageAlias(title)).toBe(alias);
  });

  it('strips every diacritic, not only the Swedish ones', () => {
    expect(toCmsPageAlias('Åland Över Ärende Crème Brûlée')).toBe(
      'aland-over-arende-creme-brulee',
    );
  });

  it('turns each run of other characters into one dash, none at the ends', () => {
    expect(toCmsPageAlias('  Frågor & svar -- 2026!  ')).toBe(
      'fragor-svar-2026',
    );
  });

  it('turns letters with no base letter into dashes, as one rule for the landing and the match', () => {
    expect(toCmsPageAlias('Smørbrød Æble Straße Łódź')).toBe(
      'sm-rbr-d-ble-stra-e-odz',
    );
  });

  it('answers an empty alias for a non-Latin title', () => {
    expect(toCmsPageAlias('Привет мир')).toBe('');
    expect(toCmsPageAlias('日本語')).toBe('');
  });

  it('answers an empty alias for a missing or symbol-only title', () => {
    expect(toCmsPageAlias(undefined)).toBe('');
    expect(toCmsPageAlias('')).toBe('');
    expect(toCmsPageAlias('&!?')).toBe('');
  });
});

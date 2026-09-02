import { describe, it, expect } from 'vitest';
import {
  ISO_3166_1_ALPHA2,
  isIsoRegion,
} from '../../../shared/constants/iso-regions';

describe('ISO_3166_1_ALPHA2', () => {
  it('carries the 249 officially assigned codes, with no duplicates', () => {
    expect(ISO_3166_1_ALPHA2).toHaveLength(249);
    expect(new Set(ISO_3166_1_ALPHA2).size).toBe(249);
  });

  it('is upper-case two-letter codes only', () => {
    for (const code of ISO_3166_1_ALPHA2) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });
});

describe('isIsoRegion', () => {
  it('accepts assigned regions in either case', () => {
    expect(isIsoRegion('SE')).toBe(true);
    expect(isIsoRegion('se')).toBe(true);
    expect(isIsoRegion('fi')).toBe(true);
    expect(isIsoRegion('no')).toBe(true);
    expect(isIsoRegion('dk')).toBe(true);
    expect(isIsoRegion('gb')).toBe(true);
  });

  it('rejects codes that are reserved rather than assigned', () => {
    // 'eu' and 'uk' are exceptionally reserved, 'xk' user-assigned.
    expect(isIsoRegion('eu')).toBe(false);
    expect(isIsoRegion('uk')).toBe(false);
    expect(isIsoRegion('xk')).toBe(false);
  });

  it('rejects malformed, empty and absent values', () => {
    expect(isIsoRegion('zzz')).toBe(false);
    expect(isIsoRegion('s')).toBe(false);
    expect(isIsoRegion('')).toBe(false);
    expect(isIsoRegion(null)).toBe(false);
    expect(isIsoRegion(undefined)).toBe(false);
  });
});

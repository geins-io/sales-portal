import { describe, it, expect } from 'vitest';
import type { ProductTextsType } from '@geins/types';
import {
  adminText,
  GEINS_ADMIN_TEXT_FIELD_MAP,
  IDENTITY_ADMIN_TEXT_FIELD_MAP,
} from '../../app/utils/product-texts';

describe('adminText', () => {
  const texts = {
    text1: 'api-text1',
    text2: 'api-text2',
    text3: 'api-text3',
  };

  it('maps PIM box numbers onto the observed offset API fields by default', () => {
    expect(adminText(texts, 1)).toBe('api-text3');
    expect(adminText(texts, 2)).toBe('api-text1');
    expect(adminText(texts, 3)).toBe('api-text2');
  });

  it('honours a caller-supplied map config instead of hardcoding the offset', () => {
    expect(adminText(texts, 1, IDENTITY_ADMIN_TEXT_FIELD_MAP)).toBe(
      'api-text1',
    );
    expect(adminText(texts, 2, IDENTITY_ADMIN_TEXT_FIELD_MAP)).toBe(
      'api-text2',
    );
    expect(adminText(texts, 3, IDENTITY_ADMIN_TEXT_FIELD_MAP)).toBe(
      'api-text3',
    );
  });

  it('exposes the offset map as data for a single fix-point', () => {
    expect(GEINS_ADMIN_TEXT_FIELD_MAP).toEqual({
      1: 'text3',
      2: 'text1',
      3: 'text2',
    });
  });

  it('normalises missing texts or null fields to undefined', () => {
    expect(adminText(undefined, 2)).toBeUndefined();
    expect(adminText(null, 3)).toBeUndefined();
    // The SDK types each text field as `string | undefined`, but the Merchant
    // API sends null and `adminText` normalises it — the impossible value is
    // what this case exists to cover, so the cast stays.
    expect(
      adminText({ text1: null } as unknown as ProductTextsType, 2),
    ).toBeUndefined();
  });
});

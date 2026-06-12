import { describe, it, expect } from 'vitest';
import { DEFAULT_CMS_CONFIG } from '../../../server/utils/tenant';
import { CMS_MENUS } from '../../../shared/constants/cms';

describe('DEFAULT_CMS_CONFIG menus', () => {
  it('maps footer registry key to dash-style menuLocationId footer-1', () => {
    expect(DEFAULT_CMS_CONFIG.menus[CMS_MENUS.FOOTER]).toEqual({
      menuLocationId: 'footer-1',
    });
  });

  it('maps footer_2 registry key to dash-style menuLocationId footer-2', () => {
    expect(DEFAULT_CMS_CONFIG.menus[CMS_MENUS.FOOTER_2]).toEqual({
      menuLocationId: 'footer-2',
    });
  });

  it('maps footer_3 registry key to dash-style menuLocationId footer-3', () => {
    expect(DEFAULT_CMS_CONFIG.menus[CMS_MENUS.FOOTER_3]).toEqual({
      menuLocationId: 'footer-3',
    });
  });

  it('CMS_MENUS registry keys use underscores and menuLocationId values use dashes', () => {
    expect(CMS_MENUS.FOOTER_2).toBe('footer_2');
    expect(CMS_MENUS.FOOTER_3).toBe('footer_3');
    expect(DEFAULT_CMS_CONFIG.menus['footer_2'].menuLocationId).toBe(
      'footer-2',
    );
    expect(DEFAULT_CMS_CONFIG.menus['footer_3'].menuLocationId).toBe(
      'footer-3',
    );
  });
});

import { describe, it, expect, vi } from 'vitest';
import { getFilterGroupLabel } from '../../app/utils/filter-labels';

/**
 * Stub `t` returns `[<key>]` so tests can assert which i18n key the helper
 * resolved to without pulling in the real i18n runtime.
 */
const t = (key: string) => `[${key}]`;

describe('getFilterGroupLabel', () => {
  describe('known groups (case-insensitive)', () => {
    it('maps "Brand" to product.filter_groups.brands', () => {
      expect(getFilterGroupLabel('Brand', t)).toBe(
        '[product.filter_groups.brands]',
      );
    });

    it('maps "brand" (lowercase) to product.filter_groups.brands', () => {
      expect(getFilterGroupLabel('brand', t)).toBe(
        '[product.filter_groups.brands]',
      );
    });

    it('maps "BRAND" (uppercase) to product.filter_groups.brands', () => {
      expect(getFilterGroupLabel('BRAND', t)).toBe(
        '[product.filter_groups.brands]',
      );
    });

    it('maps plural "brands" to product.filter_groups.brands', () => {
      expect(getFilterGroupLabel('brands', t)).toBe(
        '[product.filter_groups.brands]',
      );
    });

    it('maps "Category" to product.filter_groups.categories', () => {
      expect(getFilterGroupLabel('Category', t)).toBe(
        '[product.filter_groups.categories]',
      );
    });

    it('maps "categories" to product.filter_groups.categories', () => {
      expect(getFilterGroupLabel('categories', t)).toBe(
        '[product.filter_groups.categories]',
      );
    });

    it('maps "Sku" to product.filter_groups.skus', () => {
      expect(getFilterGroupLabel('Sku', t)).toBe(
        '[product.filter_groups.skus]',
      );
    });

    it('maps "Stock status" (with space) to product.filter_groups.stock_status', () => {
      expect(getFilterGroupLabel('Stock status', t)).toBe(
        '[product.filter_groups.stock_status]',
      );
    });

    it('maps "STOCK_STATUS" (uppercase underscored) to product.filter_groups.stock_status', () => {
      expect(getFilterGroupLabel('STOCK_STATUS', t)).toBe(
        '[product.filter_groups.stock_status]',
      );
    });

    it('maps "stockstatus" (collapsed) to product.filter_groups.stock_status', () => {
      expect(getFilterGroupLabel('stockstatus', t)).toBe(
        '[product.filter_groups.stock_status]',
      );
    });

    it('maps "Price" to product.filter_groups.price', () => {
      expect(getFilterGroupLabel('Price', t)).toBe(
        '[product.filter_groups.price]',
      );
    });

    it('maps "Discount" to product.filter_groups.discount', () => {
      expect(getFilterGroupLabel('Discount', t)).toBe(
        '[product.filter_groups.discount]',
      );
    });

    it('maps "Sale" to product.filter_groups.discount', () => {
      expect(getFilterGroupLabel('Sale', t)).toBe(
        '[product.filter_groups.discount]',
      );
    });

    it('maps "Campaign" to product.filter_groups.campaigns', () => {
      expect(getFilterGroupLabel('Campaign', t)).toBe(
        '[product.filter_groups.campaigns]',
      );
    });

    it('maps "campaigns" to product.filter_groups.campaigns', () => {
      expect(getFilterGroupLabel('campaigns', t)).toBe(
        '[product.filter_groups.campaigns]',
      );
    });

    it('trims leading/trailing whitespace before lookup', () => {
      expect(getFilterGroupLabel('  Brand  ', t)).toBe(
        '[product.filter_groups.brands]',
      );
    });
  });

  describe('unknown groups (passthrough)', () => {
    it('passes through "Color" unchanged', () => {
      expect(getFilterGroupLabel('Color', t)).toBe('Color');
    });

    it('passes through "Material" unchanged', () => {
      expect(getFilterGroupLabel('Material', t)).toBe('Material');
    });

    it('does not invoke t() for unknown groups', () => {
      const spy = vi.fn((key: string) => `[${key}]`);
      getFilterGroupLabel('Color', spy);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('empty / null / undefined input', () => {
    it('returns empty string for empty input', () => {
      expect(getFilterGroupLabel('', t)).toBe('');
    });

    it('returns empty string for null input', () => {
      expect(getFilterGroupLabel(null, t)).toBe('');
    });

    it('returns empty string for undefined input', () => {
      expect(getFilterGroupLabel(undefined, t)).toBe('');
    });

    it('passes whitespace-only input through as raw (unknown group)', () => {
      // Trimmed lookup yields empty string → not in the map → raw passthrough.
      expect(getFilterGroupLabel('   ', t)).toBe('   ');
    });

    it('does not invoke t() for empty/null/undefined input', () => {
      const spy = vi.fn((key: string) => `[${key}]`);
      getFilterGroupLabel('', spy);
      getFilterGroupLabel(null, spy);
      getFilterGroupLabel(undefined, spy);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});

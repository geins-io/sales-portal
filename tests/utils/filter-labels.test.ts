import { describe, it, expect, vi } from 'vitest';
import { getFilterGroupLabel } from '../../app/utils/filter-labels';

/**
 * Stub `t` returns `[<key>]` so tests can assert which i18n key the helper
 * resolved to without pulling in the real i18n runtime.
 */
const t = (key: string) => `[${key}]`;

type Overrides = Partial<
  Record<'group' | 'label' | 'type' | 'filterId', string | null>
>;

/**
 * Builds a facet identity. Defaults mirror a real Geins system-filter payload:
 * `group` / `label` are null and the identity is carried in `type` / `filterId`.
 */
function facet(overrides: Overrides) {
  return {
    group: null,
    label: null,
    type: '',
    filterId: '',
    ...overrides,
  } as unknown as Parameters<typeof getFilterGroupLabel>[0];
}

describe('getFilterGroupLabel', () => {
  describe('known groups via the group field (case-insensitive)', () => {
    it('maps "Brand" to product.filter_groups.brands', () => {
      expect(getFilterGroupLabel(facet({ group: 'Brand' }), t)).toBe(
        '[product.filter_groups.brands]',
      );
    });

    it('maps "brand" (lowercase) to product.filter_groups.brands', () => {
      expect(getFilterGroupLabel(facet({ group: 'brand' }), t)).toBe(
        '[product.filter_groups.brands]',
      );
    });

    it('maps "BRAND" (uppercase) to product.filter_groups.brands', () => {
      expect(getFilterGroupLabel(facet({ group: 'BRAND' }), t)).toBe(
        '[product.filter_groups.brands]',
      );
    });

    it('maps plural "brands" to product.filter_groups.brands', () => {
      expect(getFilterGroupLabel(facet({ group: 'brands' }), t)).toBe(
        '[product.filter_groups.brands]',
      );
    });

    it('maps "Category" to product.filter_groups.categories', () => {
      expect(getFilterGroupLabel(facet({ group: 'Category' }), t)).toBe(
        '[product.filter_groups.categories]',
      );
    });

    it('maps "categories" to product.filter_groups.categories', () => {
      expect(getFilterGroupLabel(facet({ group: 'categories' }), t)).toBe(
        '[product.filter_groups.categories]',
      );
    });

    it('maps "Sku" to product.filter_groups.skus', () => {
      expect(getFilterGroupLabel(facet({ group: 'Sku' }), t)).toBe(
        '[product.filter_groups.skus]',
      );
    });

    it('maps "Stock status" (with space) to product.filter_groups.stock_status', () => {
      expect(getFilterGroupLabel(facet({ group: 'Stock status' }), t)).toBe(
        '[product.filter_groups.stock_status]',
      );
    });

    it('maps "STOCK_STATUS" (uppercase underscored) to product.filter_groups.stock_status', () => {
      expect(getFilterGroupLabel(facet({ group: 'STOCK_STATUS' }), t)).toBe(
        '[product.filter_groups.stock_status]',
      );
    });

    it('maps "stockstatus" (collapsed) to product.filter_groups.stock_status', () => {
      expect(getFilterGroupLabel(facet({ group: 'stockstatus' }), t)).toBe(
        '[product.filter_groups.stock_status]',
      );
    });

    it('maps "Price" to product.filter_groups.price', () => {
      expect(getFilterGroupLabel(facet({ group: 'Price' }), t)).toBe(
        '[product.filter_groups.price]',
      );
    });

    it('maps "Discount" to product.filter_groups.discount', () => {
      expect(getFilterGroupLabel(facet({ group: 'Discount' }), t)).toBe(
        '[product.filter_groups.discount]',
      );
    });

    it('maps "Sale" to product.filter_groups.discount', () => {
      expect(getFilterGroupLabel(facet({ group: 'Sale' }), t)).toBe(
        '[product.filter_groups.discount]',
      );
    });

    it('maps "Campaign" to product.filter_groups.campaigns', () => {
      expect(getFilterGroupLabel(facet({ group: 'Campaign' }), t)).toBe(
        '[product.filter_groups.campaigns]',
      );
    });

    it('maps "campaigns" to product.filter_groups.campaigns', () => {
      expect(getFilterGroupLabel(facet({ group: 'campaigns' }), t)).toBe(
        '[product.filter_groups.campaigns]',
      );
    });

    it('trims leading/trailing whitespace before lookup', () => {
      expect(getFilterGroupLabel(facet({ group: '  Brand  ' }), t)).toBe(
        '[product.filter_groups.brands]',
      );
    });
  });

  // The bug this fixes: Geins system filters return group:null and carry their
  // identity in `type` / `filterId`, so resolving only `group` bled the raw
  // English ("Brand", "Category", "Sku") through on Swedish storefronts.
  describe('system filters resolve via type / filterId when group is null', () => {
    it('resolves type "Brand" to brands when group is null', () => {
      expect(getFilterGroupLabel(facet({ group: null, type: 'Brand' }), t)).toBe(
        '[product.filter_groups.brands]',
      );
    });

    it('resolves type "Category" to categories when group is null', () => {
      expect(
        getFilterGroupLabel(facet({ group: null, type: 'Category' }), t),
      ).toBe('[product.filter_groups.categories]');
    });

    it('resolves type "Price" to price when group is null', () => {
      expect(getFilterGroupLabel(facet({ group: null, type: 'Price' }), t)).toBe(
        '[product.filter_groups.price]',
      );
    });

    it('resolves type "Sku" to skus when group is null', () => {
      expect(getFilterGroupLabel(facet({ group: null, type: 'Sku' }), t)).toBe(
        '[product.filter_groups.skus]',
      );
    });

    it('resolves type "StockStatus" to stock_status even when a raw English label is present', () => {
      expect(
        getFilterGroupLabel(
          facet({ group: null, label: 'Stock status', type: 'StockStatus' }),
          t,
        ),
      ).toBe('[product.filter_groups.stock_status]');
    });

    it('resolves via filterId when group and type are both empty', () => {
      expect(
        getFilterGroupLabel(
          facet({ group: null, type: '', filterId: 'Brand' }),
          t,
        ),
      ).toBe('[product.filter_groups.brands]');
    });

    it('prefers a known group over type (resolution order)', () => {
      expect(
        getFilterGroupLabel(facet({ group: 'Category', type: 'Brand' }), t),
      ).toBe('[product.filter_groups.categories]');
    });
  });

  describe('custom parameter filters fall back to a human-readable label', () => {
    it('returns the label for an unknown parameter group', () => {
      expect(
        getFilterGroupLabel(
          facet({ group: 'Color', label: 'Color', type: 'Parameter' }),
          t,
        ),
      ).toBe('Color');
    });

    it('falls back to group when the label is empty', () => {
      expect(
        getFilterGroupLabel(
          facet({ group: 'Material', label: null, type: 'Parameter' }),
          t,
        ),
      ).toBe('Material');
    });

    it('does not invoke t() for an unknown facet', () => {
      const spy = vi.fn((key: string) => `[${key}]`);
      getFilterGroupLabel(
        facet({ group: 'Color', label: 'Color', type: 'Parameter' }),
        spy,
      );
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('empty identity', () => {
    it('returns empty string when every identity field is empty', () => {
      expect(
        getFilterGroupLabel(
          facet({ group: null, label: null, type: '', filterId: '' }),
          t,
        ),
      ).toBe('');
    });

    it('does not invoke t() for an empty facet', () => {
      const spy = vi.fn((key: string) => `[${key}]`);
      getFilterGroupLabel(facet({}), spy);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});

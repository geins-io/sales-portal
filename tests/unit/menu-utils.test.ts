import { describe, it, expect } from 'vitest';
import {
  normalizeMenuUrl,
  stripGeinsPrefix,
  getMenuLabel,
  getVisibleItems,
  isExternalUrl,
} from '../../shared/utils/menu';
import type { MenuItemType } from '../../shared/types/cms';

describe('stripGeinsPrefix', () => {
  it('maps Geins /l/ type indicator to /c/ (category)', () => {
    expect(stripGeinsPrefix('/se/sv/l/epoxi')).toBe('/c/epoxi');
  });

  it('strips market/locale prefix from CMS page URL (no type indicator)', () => {
    expect(stripGeinsPrefix('/se/sv/about-us')).toBe('/about-us');
  });

  it('maps Geins /p/ type indicator to /p/ (product)', () => {
    expect(stripGeinsPrefix('/se/sv/p/epoxi/my-product')).toBe(
      '/p/epoxi/my-product',
    );
  });

  it('handles locale with region code', () => {
    expect(stripGeinsPrefix('/se/sv-se/l/epoxi')).toBe('/c/epoxi');
  });

  it('returns path as-is when no prefix matches', () => {
    expect(stripGeinsPrefix('/about-us')).toBe('/about-us');
    expect(stripGeinsPrefix('/epoxi')).toBe('/epoxi');
  });

  it('does NOT strip first letter of multi-char path segments', () => {
    // Regression: /se/en/materials was returning /aterials because 'm'
    // matched the single-char type indicator pattern (meant for /l/, /p/, /b/)
    expect(stripGeinsPrefix('/se/en/materials')).toBe('/materials');
    expect(stripGeinsPrefix('/se/en/equipment/compressors-1')).toBe(
      '/equipment/compressors-1',
    );
    expect(stripGeinsPrefix('/se/sv/kompressorer')).toBe('/kompressorer');
    expect(stripGeinsPrefix('/se/en/contact')).toBe('/contact');
  });

  it('preserves nested paths after stripping prefix', () => {
    expect(stripGeinsPrefix('/se/en/materials/branch-pipes')).toBe(
      '/materials/branch-pipes',
    );
    expect(stripGeinsPrefix('/se/en/safety-misc/protective-equipment')).toBe(
      '/safety-misc/protective-equipment',
    );
  });

  it('maps single-char type indicators to route prefixes', () => {
    expect(stripGeinsPrefix('/se/sv/l/epoxi')).toBe('/c/epoxi');
    expect(stripGeinsPrefix('/se/sv/p/cat/product')).toBe('/p/cat/product');
    expect(stripGeinsPrefix('/se/sv/b/our-company')).toBe('/b/our-company');
  });

  it('maps /dc/ type indicator to /dc/ (discount campaign)', () => {
    expect(stripGeinsPrefix('/se/sv/dc/summer-sale')).toBe('/dc/summer-sale');
  });
});

describe('normalizeMenuUrl', () => {
  it('returns route-prefixed path for category URL', () => {
    expect(normalizeMenuUrl('/se/sv/l/epoxi')).toBe('/c/epoxi');
  });

  it('returns simple relative path as-is', () => {
    expect(normalizeMenuUrl('/about-us')).toBe('/about-us');
  });

  it('strips hostname and maps Geins prefix from absolute URL', () => {
    expect(
      normalizeMenuUrl(
        'https://monitor.example.com/se/sv/l/epoxi',
        'monitor.example.com',
      ),
    ).toBe('/c/epoxi');
  });

  it('keeps full URL when hostname does not match', () => {
    expect(normalizeMenuUrl('https://other.com/page', 'mystore.com')).toBe(
      'https://other.com/page',
    );
  });

  it('returns empty string for undefined/empty input', () => {
    expect(normalizeMenuUrl(undefined)).toBe('');
    expect(normalizeMenuUrl('')).toBe('');
  });

  it('handles URL with port', () => {
    expect(
      normalizeMenuUrl('https://localhost:3000/about', 'localhost:3000'),
    ).toBe('/about');
  });
});

describe('getMenuLabel', () => {
  it('prefers label over title', () => {
    expect(getMenuLabel({ label: 'Label', title: 'Title' })).toBe('Label');
  });

  it('falls back to title', () => {
    expect(getMenuLabel({ title: 'Title' })).toBe('Title');
  });

  it('returns empty string when neither exists', () => {
    expect(getMenuLabel({})).toBe('');
  });
});

describe('getVisibleItems', () => {
  it('filters out hidden items', () => {
    const items: MenuItemType[] = [
      { id: '1', label: 'Visible', hidden: false },
      { id: '2', label: 'Hidden', hidden: true },
      { id: '3', label: 'Also visible' },
    ];
    const result = getVisibleItems(items);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(['1', '3']);
  });

  it('sorts by order', () => {
    const items: MenuItemType[] = [
      { id: '1', label: 'Third', order: 3 },
      { id: '2', label: 'First', order: 1 },
      { id: '3', label: 'Second', order: 2 },
    ];
    const result = getVisibleItems(items);
    expect(result.map((i) => i.id)).toEqual(['2', '3', '1']);
  });

  it('returns empty array for undefined input', () => {
    expect(getVisibleItems(undefined)).toEqual([]);
  });
});

describe('isExternalUrl', () => {
  it('returns false for relative paths', () => {
    expect(isExternalUrl('/about')).toBe(false);
  });

  it('returns false for matching hostname', () => {
    expect(isExternalUrl('https://mystore.com/page', 'mystore.com')).toBe(
      false,
    );
  });

  it('returns true for different hostname', () => {
    expect(isExternalUrl('https://other.com/page', 'mystore.com')).toBe(true);
  });

  it('returns true for absolute URL without currentHost', () => {
    expect(isExternalUrl('https://example.com/page')).toBe(true);
  });
});

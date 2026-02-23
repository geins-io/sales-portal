import { describe, it, expect } from 'vitest';
import {
  normalizeMenuUrl,
  getMenuLabel,
  getVisibleItems,
  isExternalUrl,
} from '../../shared/utils/menu';
import type { MenuItemType } from '../../shared/types/cms';

describe('normalizeMenuUrl', () => {
  it('returns relative path as-is', () => {
    expect(normalizeMenuUrl('/about-us')).toBe('/about-us');
  });

  it('strips matching hostname from absolute URL', () => {
    expect(
      normalizeMenuUrl(
        'https://monitor.example.com/se/sv/l/epoxi',
        'monitor.example.com',
      ),
    ).toBe('/se/sv/l/epoxi');
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

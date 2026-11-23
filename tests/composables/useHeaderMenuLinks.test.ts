// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import type { MenuItemType } from '#shared/types/cms';
import { ROUTE_PATHS } from '#shared/constants/route-paths';

// Prefixes the path as given, so '' and '/' stay apart.
const localePath = (path: string) => `/se/sv${path}`;

vi.mock('../../app/composables/useLocaleMarket', () => ({
  useLocaleMarket: () => ({ localePath }),
}));
vi.stubGlobal('useLocaleMarket', () => ({ localePath }));
const requestUrl = () => new URL('https://shop.example.com/x');
vi.mock('#app/composables/url', () => ({ useRequestURL: requestUrl }));
vi.stubGlobal('useRequestURL', requestUrl);

const { useHeaderMenuLinks } =
  await import('../../app/composables/useHeaderMenuLinks');

function item(fields: Partial<MenuItemType>): MenuItemType {
  return { id: '1', label: 'Item', order: 1, ...fields } as MenuItemType;
}

describe('useHeaderMenuLinks', () => {
  const { visibleChildren, linkTag, linkAttrs } = useHeaderMenuLinks();

  it('links an internal item through localePath with NuxtLink, in this tab', () => {
    const link = item({ canonicalUrl: '/se/sv/kontakt' });
    expect(linkTag(link)).not.toBe('a');
    expect(linkAttrs(link)).toEqual({
      to: '/se/sv/kontakt',
      target: undefined,
      rel: undefined,
    });
  });

  it('treats an absolute link to this host as internal', () => {
    const link = item({
      canonicalUrl: 'https://shop.example.com/se/sv/kontakt',
    });
    expect(linkTag(link)).not.toBe('a');
    expect(linkAttrs(link).to).toBe('/se/sv/kontakt');
  });

  it('prefixes a category with children so it routes to the category page', () => {
    const category = item({
      canonicalUrl: '/se/sv/verktyg',
      children: [item({ id: '2', canonicalUrl: '/se/sv/verktyg/el' })],
    });
    expect(linkAttrs(category).to).toBe(
      `/se/sv${ROUTE_PATHS.category}/verktyg`,
    );
  });

  it('opens a link to another host as a plain anchor in a new tab, unprefixed', () => {
    const link = item({
      canonicalUrl: 'https://other.example.com/page',
      children: [item({ id: '2' })],
    });
    expect(linkTag(link)).toBe('a');
    expect(linkAttrs(link)).toEqual({
      href: 'https://other.example.com/page',
      target: '_blank',
      rel: 'noopener',
    });
  });

  it('opens an internal item marked targetBlank as a plain anchor in a new tab', () => {
    const link = item({ canonicalUrl: '/se/sv/kontakt', targetBlank: true });
    expect(linkTag(link)).toBe('a');
    expect(linkAttrs(link)).toMatchObject({
      target: '_blank',
      rel: 'noopener',
    });
    expect(linkAttrs(link)).not.toHaveProperty('to');
  });

  it('falls back to the start page for an item without a url', () => {
    expect(linkAttrs(item({ canonicalUrl: '' })).to).toBe('/se/sv/');
    expect(linkAttrs(item({ canonicalUrl: '', targetBlank: true })).href).toBe(
      '/',
    );
  });

  it('lists only the visible children', () => {
    const parent = item({
      children: [
        item({ id: '2', label: 'Shown' }),
        item({ id: '3', label: 'Hidden', hidden: true }),
      ],
    });
    expect(visibleChildren(parent).map((c) => c.label)).toEqual(['Shown']);
    expect(visibleChildren(item({}))).toEqual([]);
  });
});

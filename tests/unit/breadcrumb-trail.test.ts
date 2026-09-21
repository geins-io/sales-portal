import { describe, it, expect } from 'vitest';
import {
  ancestorCrumbs,
  ancestorsFromCategories,
  type CategoryAncestor,
  type CategoryNode,
} from '../../shared/utils/breadcrumb-trail';

// Mimics localePath from useLocaleMarket: prepends the active /market/locale.
const localizeSeSv = (path: string) => `/se/sv${path}`;

const INDEX: Record<string, CategoryAncestor> = {
  fastelement: {
    categoryId: 1,
    name: 'Fästelement',
    canonicalUrl: '/se/sv/c/fastelement',
  },
  testkategori: {
    categoryId: 7,
    name: 'Testkategori',
    canonicalUrl: '/se/sv/c/fastelement/testkategori',
  },
  // The prefix-less shape other tenants return.
  'sakerhet-och-ovrigt': {
    categoryId: 20,
    name: 'Säkerhet och övrigt',
    canonicalUrl: '/se/sv/sakerhet-och-ovrigt',
  },
};

describe('ancestorCrumbs', () => {
  it('normalizes both canonical shapes to the same /c/ route', () => {
    expect(
      ancestorCrumbs(
        [INDEX.testkategori!, INDEX['sakerhet-och-ovrigt']!],
        localizeSeSv,
      ),
    ).toEqual([
      {
        label: 'Testkategori',
        href: '/se/sv/c/fastelement/testkategori',
      },
      {
        label: 'Säkerhet och övrigt',
        href: '/se/sv/c/sakerhet-och-ovrigt',
      },
    ]);
  });

  it('returns nothing for an absent chain', () => {
    expect(ancestorCrumbs(undefined, localizeSeSv)).toEqual([]);
    expect(ancestorCrumbs(null, localizeSeSv)).toEqual([]);
    expect(ancestorCrumbs([], localizeSeSv)).toEqual([]);
  });
});

describe('ancestorsFromCategories', () => {
  // Measured on sonoralab: every product in this branch carries the same
  // three-entry closure, whatever its primary category is.
  const CLOSURE: CategoryNode[] = [
    {
      categoryId: 1,
      parentCategoryId: 0,
      name: 'Fästelement',
      canonicalUrl: '/se/sv/c/fastelement',
    },
    {
      categoryId: 7,
      parentCategoryId: 1,
      name: 'Testkategori',
      canonicalUrl: '/se/sv/c/fastelement/testkategori',
    },
    {
      categoryId: 9,
      parentCategoryId: 7,
      name: 'Testkategori-L3',
      canonicalUrl: '/se/sv/c/fastelement/testkategori/testkategori-l3',
    },
  ];

  it('walks parentCategoryId up from the primary category, root first', () => {
    expect(ancestorsFromCategories(CLOSURE, 9).map((a) => a.name)).toEqual([
      'Fästelement',
      'Testkategori',
    ]);
    expect(ancestorsFromCategories(CLOSURE, 7).map((a) => a.name)).toEqual([
      'Fästelement',
    ]);
    expect(ancestorsFromCategories(CLOSURE, 1)).toEqual([]);
  });

  it('ignores order, because it differs between tenants', () => {
    // sonoralab returns root-first, another tenant leaf-first. Reading it
    // positionally would be right on one tenant and wrong on the other.
    expect(
      ancestorsFromCategories([...CLOSURE].reverse(), 9).map((a) => a.name),
    ).toEqual(['Fästelement', 'Testkategori']);
  });

  it('never visits a category off the primary chain', () => {
    // Measured live: a product whose primary is Testkategori is ALSO assigned to
    // Testkategori-L3, a descendant. The trail follows the primary, so the
    // secondary assignment must not appear — the decision on the ticket.
    expect(
      ancestorsFromCategories(CLOSURE, 7).map((a) => a.name),
    ).not.toContain('Testkategori-L3');

    const sibling: CategoryNode = {
      categoryId: 20,
      parentCategoryId: 0,
      name: 'Verktyg',
      canonicalUrl: '/se/sv/c/verktyg',
    };
    expect(
      ancestorsFromCategories([...CLOSURE, sibling], 7).map((a) => a.name),
    ).toEqual(['Fästelement']);
  });

  it('drops the WHOLE chain when a parent is missing from the closure', () => {
    // Constructed, not taken from live data: id 7 claims parent 1, which is
    // absent. A partial trail would render `Home › Testkategori` and look
    // exactly like the bug this fixes.
    const broken = CLOSURE.filter((c) => c.categoryId !== 1);
    expect(ancestorsFromCategories(broken, 9)).toEqual([]);
    expect(ancestorsFromCategories(broken, 7)).toEqual([]);
  });

  it('drops the chain when an ancestor has no name or canonicalUrl', () => {
    const nameless = CLOSURE.map((c) =>
      c.categoryId === 1 ? { ...c, name: null } : c,
    );
    expect(ancestorsFromCategories(nameless, 7)).toEqual([]);

    const urlless = CLOSURE.map((c) =>
      c.categoryId === 1 ? { ...c, canonicalUrl: null } : c,
    );
    expect(ancestorsFromCategories(urlless, 7)).toEqual([]);
  });

  it('refuses a non-number parent instead of reading it as the root', () => {
    // Only 0 ends the walk. `CategoryType.parentCategoryId` is a non-optional
    // number in @geins/types and roots report 0 on every tenant measured, so a
    // null, missing or string parent is data the walk cannot reason about.
    // Treating it as "root reached" returned a partial chain — the one thing
    // this function promises never to do.
    for (const bad of [null, undefined, '1'] as unknown[]) {
      const broken = CLOSURE.map((c) =>
        c.categoryId === 7 ? { ...c, parentCategoryId: bad as number } : c,
      );
      expect(ancestorsFromCategories(broken, 9)).toEqual([]);
    }
  });

  it('refuses a cycle instead of hanging', () => {
    const cyclic: CategoryNode[] = [
      { categoryId: 1, parentCategoryId: 2, name: 'A', canonicalUrl: '/a' },
      { categoryId: 2, parentCategoryId: 1, name: 'B', canonicalUrl: '/b' },
    ];
    expect(ancestorsFromCategories(cyclic, 1)).toEqual([]);
  });

  it('refuses a cycle that closes ABOVE the primary category', () => {
    // The primary is outside the loop, so the id seeded into `seen` is never
    // revisited: only the ids added DURING the walk can end it. Without that,
    // this input spins forever rather than returning a partial chain.
    const cyclic: CategoryNode[] = [
      { categoryId: 3, parentCategoryId: 2, name: 'C', canonicalUrl: '/c' },
      { categoryId: 2, parentCategoryId: 1, name: 'B', canonicalUrl: '/b' },
      { categoryId: 1, parentCategoryId: 2, name: 'A', canonicalUrl: '/a' },
    ];
    expect(ancestorsFromCategories(cyclic, 3)).toEqual([]);
  });

  it('returns nothing when the primary category is absent or unknown', () => {
    expect(ancestorsFromCategories(CLOSURE, undefined)).toEqual([]);
    expect(ancestorsFromCategories(CLOSURE, null)).toEqual([]);
    expect(ancestorsFromCategories(CLOSURE, 999)).toEqual([]);
    expect(ancestorsFromCategories(null, 7)).toEqual([]);
    expect(ancestorsFromCategories([], 7)).toEqual([]);
  });

  it('tolerates null entries and entries with no id', () => {
    expect(
      ancestorsFromCategories([null, undefined, { name: 'x' }, ...CLOSURE], 7),
    ).toEqual([
      {
        categoryId: 1,
        name: 'Fästelement',
        canonicalUrl: '/se/sv/c/fastelement',
      },
    ]);
  });
});

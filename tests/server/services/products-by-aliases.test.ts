import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { H3Event } from 'h3';

const mockQuery = vi.fn();
const channel = { channelId: '1|se', languageId: 'sv-SE', marketId: 'se' };

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn(async () => ({
    core: { geinsSettings: { locale: 'sv-SE' }, graphql: { query: mockQuery } },
  })),
  getRequestChannelVariables: vi.fn(() => ({ ...channel })),
}));

vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn((path: string) => `query:${path}`),
  withFragments: vi.fn((query: string) => `${query}\n#fragments`),
}));

const mockWarn = vi.fn();
vi.mock('../../../server/utils/logger', () => ({
  logger: { warn: (...args: unknown[]) => mockWarn(...args) },
}));

vi.stubGlobal(
  'wrapServiceCall',
  vi.fn(async (fn: () => Promise<unknown>) => fn()),
);

let products: typeof import('../../../server/services/products');

const event = {
  context: {
    tenant: {
      config: { channelSettings: { locales: ['sv-SE', 'en-GB', 'nb-NO'] } },
    },
  },
} as unknown as H3Event;

function pageIn(languageId: string) {
  channel.languageId = languageId;
}

// The card as Geins answers it in one language.
function card(productId: number, alias: string, name: string, lang: string) {
  return {
    productId,
    type: 'product',
    alias,
    canonicalUrl: `/se/${lang.slice(0, 2)}/p/pipes/${alias}`,
    name,
    articleNumber: `ART-${productId}`,
    productImages: [
      { fileName: `${productId}.jpg`, url: `https://cdn/${productId}` },
    ],
    unitPrice: { sellingPriceExVat: 380, sellingPriceExVatFormatted: '380 kr' },
    skus: [{ skuId: productId * 10 }],
    totalStock: { inStock: 4, oversellable: 0, totalStock: 4, static: 0 },
  };
}

// Product 1031 is in every language, each with its own alias. Product 2000 is
// in the Swedish catalogue only.
const CATALOGUE: Record<string, ReturnType<typeof card>[]> = {
  'sv-SE': [
    card(1031, 'kopparror', 'Kopparrör', 'sv-SE'),
    card(2000, 'bara-svensk', 'Bara svensk', 'sv-SE'),
  ],
  'en-GB': [card(1031, 'copper-pipe', 'Copper pipe', 'en-GB')],
  'nb-NO': [card(1031, 'kobberror', 'Kobberrør', 'nb-NO')],
};
for (let id = 1; id <= 11; id++) {
  CATALOGUE['sv-SE']!.push(card(id, `sv-${id}`, `Svensk ${id}`, 'sv-SE'));
}

const byAlias = (alias: string, lang: string) =>
  CATALOGUE[lang]?.find((p) => p.alias === alias) ?? null;

type Call = { queryAsString: string; variables: Record<string, unknown> };

// Answers the stored-alias document field by field, the by-ids query from the
// catalogue, and the product page's query, so today's code runs against the
// same data.
function answer({ queryAsString, variables }: Call) {
  if (queryAsString.startsWith('query storedAliasLookup')) {
    const fields = [...queryAsString.matchAll(/(a(\d+)_(\d+)): product\(/g)];
    return Object.fromEntries(
      fields.map(([, field, i, j]) => [
        field,
        byAlias(variables[`a${i}`] as string, variables[`l${j}`] as string),
      ]),
    );
  }
  if (queryAsString === 'query:products/product-cards-by-ids.graphql') {
    const ids = (variables.filter as { productIds: number[] }).productIds;
    const lang = variables.languageId as string;
    return {
      products: {
        products: (CATALOGUE[lang] ?? []).filter((p) =>
          ids.includes(p.productId),
        ),
      },
    };
  }
  if (queryAsString === 'query:products/product.graphql') {
    return {
      product: byAlias(
        variables.alias as string,
        variables.languageId as string,
      ),
    };
  }
  throw new Error(`unexpected query ${queryAsString}`);
}

const calls = (start: string) =>
  mockQuery.mock.calls.filter(([c]) =>
    (c as Call).queryAsString.startsWith(start),
  );

beforeEach(async () => {
  vi.clearAllMocks();
  pageIn('sv-SE');
  mockQuery.mockImplementation(async (c: Call) => answer(c));
  products = await import('../../../server/services/products');
});

describe('buildStoredAliasLookup', () => {
  const ch = { channelId: '1|se', marketId: 'se' };

  it('passes every alias and language as a variable, never inside the document', () => {
    const tricky = 'a"b{c}$d\ne';
    const { query, variables } = products.buildStoredAliasLookup(
      [tricky, 'plain'],
      ['en-GB', 'sv-SE'],
      ch,
    );

    expect(query).not.toContain('plain');
    expect(query).not.toContain('a"b');
    expect(query).not.toContain('en-GB');
    expect(variables).toEqual({
      channelId: '1|se',
      marketId: 'se',
      l0: 'en-GB',
      l1: 'sv-SE',
      a0: tricky,
      a1: 'plain',
    });
  });

  it('builds the same document for an alias with quotes, braces, $ or a newline as for a plain one', () => {
    const langs = ['sv-SE', 'en-GB'];
    const plain = products.buildStoredAliasLookup(['x'], langs, ch).query;

    for (const alias of ['"', '}', '{', '$a0', 'a\nb', '") { x }']) {
      expect(products.buildStoredAliasLookup([alias], langs, ch).query).toBe(
        plain,
      );
    }
  });

  it.each([
    [1, 1],
    [3, 2],
    [10, 6],
  ])(
    'declares exactly the variables it uses, for %i aliases in %i languages',
    (n, m) => {
      const aliases = Array.from({ length: n }, (_, i) => `alias-${i}`);
      const langs = [
        'sv-SE',
        'en-GB',
        'nb-NO',
        'fi-FI',
        'de-DE',
        'da-DK',
      ].slice(0, m);
      const { query, variables } = products.buildStoredAliasLookup(
        aliases,
        langs,
        ch,
      );

      const [header, body] = query.split('{', 2) as [string, string];
      const declared = new Set(
        [...header.matchAll(/\$(\w+):/g)].map((x) => x[1]),
      );
      const rest = query.slice(header.length);
      const used = new Set([...rest.matchAll(/\$(\w+)/g)].map((x) => x[1]));

      expect(body).toBeDefined();
      expect(declared).toEqual(used);
      expect(new Set(Object.keys(variables))).toEqual(declared);
    },
  );

  it('names each field by the index of its alias and language', () => {
    const { query } = products.buildStoredAliasLookup(
      ['a', 'b', 'c'],
      ['sv-SE', 'en-GB'],
      ch,
    );

    expect([...query.matchAll(/(\w+): product\(/g)].map((x) => x[1])).toEqual([
      'a0_0',
      'a0_1',
      'a1_0',
      'a1_1',
      'a2_0',
      'a2_1',
    ]);
  });

  it('asks each field for the card fragment, with its fragments added', () => {
    const { query } = products.buildStoredAliasLookup(['a'], ['sv-SE'], ch);

    expect(query).toMatch(/a0_0: product\([^)]*\) \{ \.\.\.ProductCard \}/);
    expect(query.endsWith('#fragments')).toBe(true);
  });

  it('selects price, stock and SKUs with the same fragments as the product page', () => {
    const dir = resolve(__dirname, '../../../server/services/graphql');
    const cardFragment = readFileSync(
      `${dir}/fragments/product-card.graphql`,
      'utf8',
    );
    const productPage = readFileSync(`${dir}/products/product.graphql`, 'utf8');
    const selection = (src: string, field: string) =>
      src
        .match(new RegExp(`\\n\\s*${field}\\s*\\{([^}]*)\\}`))?.[1]
        ?.replace(/\s+/g, ' ')
        .trim();

    for (const field of ['unitPrice', 'skus', 'totalStock', 'productImages']) {
      expect(selection(cardFragment, field), field).toBe(
        selection(productPage, field),
      );
    }
    for (const field of [
      'productId',
      'type',
      'alias',
      'canonicalUrl',
      'name',
      'articleNumber',
    ]) {
      expect(cardFragment).toMatch(new RegExp(`\\n\\s*${field}\\n`));
    }
  });
});

describe('getProductsByAliases', () => {
  const lookup = (aliases: string[]) =>
    products.getProductsByAliases({ aliases, userToken: 'tok' }, event);

  it('finds a favorite stored in another language on a Swedish page, under its stored alias', async () => {
    // Stored on the English product page, read on a Swedish page: before, the
    // lookup answered nothing and the favorites page deleted the favorite.
    const found = await lookup(['copper-pipe']);

    expect(found).toEqual([
      {
        ...card(1031, 'kopparror', 'Kopparrör', 'sv-SE'),
        alias: 'copper-pipe',
      },
    ]);
  });

  it('shows a favorite stored in Swedish in the language of the page, keeping its stored alias', async () => {
    pageIn('en-GB');

    const found = await lookup(['kopparror']);

    expect(found).toEqual([
      {
        ...card(1031, 'copper-pipe', 'Copper pipe', 'en-GB'),
        alias: 'kopparror',
      },
    ]);
  });

  it('leaves the link to the alias when the alias is the one of the page language', async () => {
    pageIn('en-GB');

    const [found] = await lookup(['copper-pipe']);

    const { canonicalUrl: _, ...expected } = card(
      1031,
      'copper-pipe',
      'Copper pipe',
      'en-GB',
    );
    expect(found).toEqual(expected);
  });

  it('asks one document per ten aliases and nothing more when every alias is in the language of the page', async () => {
    const aliases = Array.from({ length: 11 }, (_, i) => `sv-${i + 1}`);

    const found = await lookup(aliases);

    expect(found.map((p) => p.name)).toEqual(
      aliases.map((_, i) => `Svensk ${i + 1}`),
    );
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(calls('query storedAliasLookup')).toHaveLength(2);
  });

  it('asks a single document for exactly ten aliases, and puts the eleventh in a document of its own', async () => {
    const ten = Array.from({ length: 10 }, (_, i) => `sv-${i + 1}`);

    await lookup(ten);
    expect(mockQuery).toHaveBeenCalledOnce();

    mockQuery.mockClear();
    await lookup([...ten, 'sv-11']);
    const documents = calls('query storedAliasLookup').map(
      ([c]) =>
        Object.keys((c as Call).variables).filter((k) => /^a\d+$/.test(k))
          .length,
    );
    expect(documents).toEqual([10, 1]);
  });

  it('asks nothing more for an alias found in no language', async () => {
    pageIn('en-GB');

    expect(await lookup(['nowhere'])).toEqual([]);
    expect(mockQuery).toHaveBeenCalledOnce();
  });

  it('looks up in the language of the page and the default language when the tenant names no languages', async () => {
    pageIn('en-GB');
    const bare = { context: { tenant: { config: {} } } } as unknown as H3Event;

    await products.getProductsByAliases({ aliases: ['kopparror'] }, bare);

    const [{ variables }] = calls('query storedAliasLookup')[0] as [Call];
    expect(Object.entries(variables).filter(([k]) => /^l\d+$/.test(k))).toEqual(
      [
        ['l0', 'en-GB'],
        ['l1', 'sv-SE'],
      ],
    );
  });

  it('looks each language up once when the language of the page is the default one', async () => {
    await lookup(['kopparror']);

    const [{ variables }] = calls('query storedAliasLookup')[0] as [Call];
    expect(Object.entries(variables).filter(([k]) => /^l\d+$/.test(k))).toEqual(
      [
        ['l0', 'sv-SE'],
        ['l1', 'en-GB'],
        ['l2', 'nb-NO'],
      ],
    );
  });

  it('fails when the lookup answers nothing, rather than an empty list the page would prune', async () => {
    mockQuery.mockResolvedValue(null);

    await expect(lookup(['kopparror'])).rejects.toThrow('no answer');
  });

  it('shows the other language when the catalogue answers no products', async () => {
    pageIn('en-GB');
    mockQuery.mockImplementation(async (c: Call) =>
      c.queryAsString.startsWith('query:products/product-cards-by-ids')
        ? { products: null }
        : answer(c),
    );

    const found = await lookup(['kopparror']);

    expect(found.map((p) => p.name)).toEqual(['Kopparrör']);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('asks the catalogue once more, by product ids passed as a variable, for aliases found only in another language', async () => {
    pageIn('en-GB');

    await lookup(['kopparror', 'kobberror', 'copper-pipe']);

    const byIds = calls('query:products/product-cards-by-ids.graphql');
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(byIds).toHaveLength(1);
    const [{ queryAsString, variables }] = byIds[0] as [Call];
    expect(queryAsString).not.toContain('1031');
    expect(variables).toEqual({
      filter: { productIds: [1031], includeCollapsed: true },
      take: 1,
      channelId: '1|se',
      languageId: 'en-GB',
      marketId: 'se',
    });
    expect(mockQuery.mock.calls[1]?.[0]).toMatchObject({ userToken: 'tok' });
  });

  it('looks each alias up in the language of the page first, then the default language, then the rest', async () => {
    pageIn('nb-NO');

    await lookup(['kopparror']);

    const [{ variables }] = calls('query storedAliasLookup')[0] as [Call];
    expect([variables.l0, variables.l1, variables.l2]).toEqual([
      'nb-NO',
      'sv-SE',
      'en-GB',
    ]);
  });

  it('leaves out an alias found in no language, and keeps the stored order', async () => {
    pageIn('en-GB');

    const found = await lookup(['nowhere', 'copper-pipe', 'kopparror']);

    expect(found.map((p) => p.alias)).toEqual(['copper-pipe', 'kopparror']);
  });

  it('shows a product missing from the catalogue of the page language as the other language has it', async () => {
    pageIn('en-GB');

    const found = await lookup(['bara-svensk']);

    const { canonicalUrl: _, ...swedish } = card(
      2000,
      'bara-svensk',
      'Bara svensk',
      'sv-SE',
    );
    expect(found).toEqual([swedish]);
  });

  it('shows the other language when the catalogue call fails, and logs it', async () => {
    pageIn('en-GB');
    mockQuery.mockImplementation(async (c: Call) => {
      if (c.queryAsString.startsWith('query:products/product-cards-by-ids')) {
        throw new Error('down');
      }
      return answer(c);
    });

    const found = await lookup(['kopparror']);

    const { canonicalUrl: _, ...swedish } = card(
      1031,
      'kopparror',
      'Kopparrör',
      'sv-SE',
    );
    expect(found).toEqual([swedish]);
    expect(mockWarn).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('[products]'),
      { error: expect.any(Error) },
    );
  });

  it('fails rather than answering a part of the list, which the page would prune', async () => {
    mockQuery.mockRejectedValue(new Error('down'));

    await expect(lookup(['kopparror'])).rejects.toThrow('down');
  });
});

describe('getCatalogueProducts', () => {
  it('reads the products in the language of the page with one call, by ids passed as a variable', async () => {
    pageIn('en-GB');
    mockQuery.mockResolvedValue({
      products: {
        products: [card(1031, 'copper-pipe', 'Copper pipe', 'en-GB')],
      },
    });

    const found = await products.getCatalogueProducts([1031, 42], event, 'tok');

    expect(found).toEqual(
      new Map([[1031, card(1031, 'copper-pipe', 'Copper pipe', 'en-GB')]]),
    );
    expect(mockQuery).toHaveBeenCalledExactlyOnceWith({
      queryAsString: 'query:products/products-by-ids.graphql',
      variables: {
        filter: { productIds: [1031, 42], includeCollapsed: true },
        take: 2,
        channelId: '1|se',
        languageId: 'en-GB',
        marketId: 'se',
      },
      userToken: 'tok',
    });
  });

  it('splits more than 600 ids, the cap of the filter, over more calls', async () => {
    mockQuery.mockResolvedValue({ products: { products: [] } });
    const ids = Array.from({ length: 601 }, (_, i) => i + 1);

    await products.getCatalogueProducts(ids, event);

    expect(mockQuery).toHaveBeenCalledTimes(2);
    const sizes = mockQuery.mock.calls.map(
      ([c]) =>
        ((c as Call).variables.filter as { productIds: number[] }).productIds
          .length,
    );
    expect(sizes).toEqual([600, 1]);
  });

  it('does not call for no ids', async () => {
    expect(await products.getCatalogueProducts([], event)).toEqual(new Map());
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('answers no products when the catalogue fails, and logs it', async () => {
    mockQuery.mockRejectedValue(new Error('down'));

    expect(await products.getCatalogueProducts([1031], event)).toEqual(
      new Map(),
    );
    expect(mockWarn).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('[products]'),
      { error: expect.any(Error) },
    );
  });

  it('answers no products, without a warning, when the catalogue has none', async () => {
    mockQuery.mockResolvedValue({ products: null });

    expect(await products.getCatalogueProducts([1031], event)).toEqual(
      new Map(),
    );
    expect(mockWarn).not.toHaveBeenCalled();
  });
});

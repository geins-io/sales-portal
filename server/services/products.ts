import type { H3Event } from 'h3';
import { getTenantSDK, getRequestChannelVariables } from './_sdk';
import { loadQuery, withFragments } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';
import { resolveWithLocaleFallback } from './_locale-fallback';
import { logger } from '../utils/logger';

/**
 * Product services — direct GraphQL via @geins/core.
 * When an SDK package covers this domain, swap the implementation here.
 * API routes won't need to change.
 */

export async function getProduct(
  args: { alias: string; userToken?: string },
  event: H3Event,
): Promise<unknown> {
  return resolveWithLocaleFallback(
    {
      queryPath: 'products/product.graphql',
      variables: { alias: args.alias },
      serviceName: 'products',
      userToken: args.userToken,
    },
    event,
  );
}

/** A product as Favorites and saved lists show it (`ProductCard` fragment). */
interface ProductCardData {
  productId: number;
  alias?: string | null;
  [field: string]: unknown;
}

/** Aliases per lookup document; ten in parallel measured level with one call per alias. */
const ALIASES_PER_DOCUMENT = 10;

/**
 * One document that looks each alias up once per language. Aliases and
 * languages travel only as variables; field names are built from indexes
 * alone, so no input ever reaches the document. Geins rejects a declared
 * variable that is not used, so it declares exactly what the fields use.
 */
export function buildStoredAliasLookup(
  aliases: readonly string[],
  languageIds: readonly string[],
  channel: { channelId: string; marketId: string },
): { query: string; variables: Record<string, string> } {
  const declarations = [
    '$channelId: String',
    '$marketId: String',
    ...languageIds.map((_, j) => `$l${j}: String`),
    ...aliases.map((_, i) => `$a${i}: String!`),
  ];
  const fields = aliases.flatMap((_, i) =>
    languageIds.map(
      (_, j) =>
        `  a${i}_${j}: product(alias: $a${i}, languageId: $l${j}, channelId: $channelId, marketId: $marketId) { ...ProductCard }`,
    ),
  );
  const variables: Record<string, string> = {
    channelId: channel.channelId,
    marketId: channel.marketId,
  };
  languageIds.forEach((languageId, j) => (variables[`l${j}`] = languageId));
  aliases.forEach((alias, i) => (variables[`a${i}`] = alias));
  return {
    query: withFragments(
      `query storedAliasLookup(${declarations.join(', ')}) {\n${fields.join('\n')}\n}`,
    ),
    variables,
  };
}

/**
 * Products for aliases stored in the browser by Favorites and saved lists, in
 * the language of the page, in the stored order.
 *
 * An alias is per language and stays the one the product was saved under. Each
 * alias is therefore looked up in every channel language at once: the page
 * language first, then the default, then the rest. An alias found only in
 * another language gives the product id, and the page-language card comes
 * from the catalogue by id, in one more call, with its page-language
 * `canonicalUrl` for the link. Every product keeps its stored alias, which is
 * how the pages know their items; an alias found in no language is left out,
 * as for a deleted product.
 */
export async function getProductsByAliases(
  args: { aliases: string[]; userToken?: string },
  event: H3Event,
): Promise<ProductCardData[]> {
  const sdk = await getTenantSDK(event);
  const channel = getRequestChannelVariables(sdk, event);
  const tenantLocales =
    (
      event.context.tenant?.config as
        { channelSettings?: { locales?: string[] } } | undefined
    )?.channelSettings?.locales ?? [];
  const languageIds = [
    ...new Set([
      channel.languageId,
      sdk.core.geinsSettings.locale,
      ...tenantLocales,
    ]),
  ];

  const chunks: string[][] = [];
  for (let i = 0; i < args.aliases.length; i += ALIASES_PER_DOCUMENT) {
    chunks.push(args.aliases.slice(i, i + ALIASES_PER_DOCUMENT));
  }
  const answers = await Promise.all(
    chunks.map(async (chunk) => {
      const { query, variables } = buildStoredAliasLookup(
        chunk,
        languageIds,
        channel,
      );
      const result = (await wrapServiceCall(
        () =>
          sdk.core.graphql.query({
            queryAsString: query,
            variables,
            userToken: args.userToken,
          }),
        'products',
      )) as Record<string, ProductCardData | null> | null;
      // No answer at all is a failure: an empty list would be pruned.
      if (!result) throw new Error('[products] stored aliases: no answer');
      return chunk.map((_, i) =>
        languageIds.map((_, j) => result[`a${i}_${j}`] ?? null),
      );
    }),
  );
  const hitsPerAlias = answers.flat();

  const elsewhere = hitsPerAlias
    .filter((hits) => !hits[0])
    .map((hits) => hits.find(Boolean)?.productId)
    .filter((id): id is number => id != null);
  const inPageLanguage = new Map<number, ProductCardData>();
  if (elsewhere.length) {
    const ids = [...new Set(elsewhere)];
    try {
      const result = unwrapGraphQL(
        await wrapServiceCall(
          () =>
            sdk.core.graphql.query({
              queryAsString: loadQuery('products/product-cards-by-ids.graphql'),
              variables: {
                filter: { productIds: ids, includeCollapsed: true },
                take: ids.length,
                ...channel,
              },
              userToken: args.userToken,
            }),
          'products',
        ),
      ) as { products?: ProductCardData[] } | null;
      for (const product of result?.products ?? []) {
        inPageLanguage.set(product.productId, product);
      }
    } catch (error) {
      logger.warn('[products] page-language cards unavailable', { error });
    }
  }

  return args.aliases.flatMap((alias, i) => {
    const hits = hitsPerAlias[i]!;
    const other = hits.find(Boolean);
    const found =
      hits[0] ?? (other && (inPageLanguage.get(other.productId) ?? other));
    if (!found) return [];
    // The link changes only for an alias of another language; any other card
    // keeps linking by its alias.
    const { canonicalUrl, ...card } = found;
    return [
      {
        ...card,
        alias,
        ...(found.alias !== alias && canonicalUrl ? { canonicalUrl } : {}),
      },
    ];
  });
}

/** Name, alias, link and images of a product, as the order pages show them. */
export interface CatalogueProduct {
  productId: number;
  name?: string | null;
  alias?: string | null;
  canonicalUrl?: string | null;
  productImages?: Array<{
    fileName?: string | null;
    url?: string | null;
  } | null> | null;
  skus?: Array<{ skuId?: number | null } | null> | null;
}

/** The ids one `productIds` filter takes. */
const IDS_PER_CATALOGUE_CALL = 600;

/**
 * Products from the catalogue in the language of the page, by id.
 *
 * An order line carries its product only in the language the order was placed
 * in; in any other its alias is empty and its images null. The order pages
 * read these from here instead. When the catalogue cannot be read the answer
 * is empty, and the pages show what the order carries.
 */
export async function getCatalogueProducts(
  productIds: readonly number[],
  event: H3Event,
  userToken?: string,
): Promise<Map<number, CatalogueProduct>> {
  const found = new Map<number, CatalogueProduct>();
  try {
    for (let i = 0; i < productIds.length; i += IDS_PER_CATALOGUE_CALL) {
      const result = (await getProductsByIds(
        {
          productIds: productIds.slice(i, i + IDS_PER_CATALOGUE_CALL),
          userToken,
        },
        event,
      )) as { products?: CatalogueProduct[] } | null;
      for (const product of result?.products ?? []) {
        found.set(product.productId, product);
      }
    }
  } catch (error) {
    logger.warn(
      '[products] catalogue unavailable; showing what the order carries',
      {
        error,
      },
    );
    return new Map();
  }
  return found;
}

/**
 * Resolve many products by product ID in a single GraphQL call.
 *
 * The Geins `products(filter: { productIds })` query returns every match in one
 * request (up to 600 ids, sorted in input order) instead of N per-alias fetches.
 * `includeCollapsed: true` is required because variant siblings are collapsed
 * out of normal product listings. Used to hydrate the PDP variant sheet, where a
 * product can have dozens of siblings, far more than a per-alias fan-out can
 * carry without timing out or blowing the request size. Returns the slim
 * `productsByIds` payload (name + articleNumber + price + images + type + SKU
 * ids, no nested variantGroup).
 */
export async function getProductsByIds(
  args: { productIds: number[]; userToken?: string },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('products/products-by-ids.graphql'),
        variables: {
          filter: { productIds: args.productIds, includeCollapsed: true },
          take: args.productIds.length,
          ...getRequestChannelVariables(sdk, event),
        },
        userToken: args.userToken,
      }),
    'products',
  );
  return unwrapGraphQL(result);
}

export async function getRelatedProducts(
  args: { alias: string; userToken?: string },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('products/related-products.graphql'),
        variables: {
          alias: args.alias,
          ...getRequestChannelVariables(sdk, event),
        },
        userToken: args.userToken,
      }),
    'products',
  );
  return unwrapGraphQL(result);
}

export async function getReviews(
  args: { alias: string; skip?: number; take?: number; userToken?: string },
  event: H3Event,
): Promise<unknown> {
  const { userToken, ...variables } = args;
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('products/reviews.graphql'),
        variables: { ...variables, ...getRequestChannelVariables(sdk, event) },
        userToken,
      }),
    'products',
  );
  return unwrapGraphQL(result);
}

export async function getPriceHistory(
  args: { alias: string; userToken?: string },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('products/price-history.graphql'),
        variables: {
          alias: args.alias,
          ...getRequestChannelVariables(sdk, event),
        },
        userToken: args.userToken,
      }),
    'products',
  );
  return unwrapGraphQL(result);
}

export async function postReview(
  args: {
    alias: string;
    rating: number;
    author: string;
    comment?: string;
    userToken?: string;
  },
  event: H3Event,
): Promise<unknown> {
  const { userToken, ...variables } = args;
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.mutation({
        queryAsString: loadQuery('products/post-review.graphql'),
        variables: { ...variables, ...getRequestChannelVariables(sdk, event) },
        userToken,
      }),
    'products',
  );
  return unwrapGraphQL(result);
}

export async function monitorAvailability(
  args: { email: string; skuId: number; userToken?: string },
  event: H3Event,
): Promise<unknown> {
  const { userToken, ...variables } = args;
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.mutation({
        queryAsString: loadQuery('products/monitor-availability.graphql'),
        variables: { ...variables, ...getRequestChannelVariables(sdk, event) },
        userToken,
      }),
    'products',
  );
  return unwrapGraphQL(result);
}

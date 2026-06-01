import type { H3Event } from 'h3';
import { getTenantSDK, getRequestChannelVariables } from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';

/**
 * Product services — direct GraphQL via @geins/core.
 * When an SDK package covers this domain, swap the implementation here.
 * API routes won't need to change.
 */

export async function getProduct(
  args: { alias: string; userToken?: string },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  const channelVars = getRequestChannelVariables(sdk, event);
  const queryAsString = loadQuery('products/product.graphql');

  const runQuery = (languageId: string) =>
    wrapServiceCall(
      () =>
        sdk.core.graphql.query({
          queryAsString,
          variables: { alias: args.alias, ...channelVars, languageId },
          userToken: args.userToken,
        }),
      'products',
    );

  const first = unwrapGraphQL(await runQuery(channelVars.languageId));

  // Geins's product(alias:, languageId:) returns null when the product is not
  // published in the requested language. Fall back to the tenant's default
  // locale so the PDP renders (with default-language content) instead of 404.
  const defaultLanguageId = sdk.core.geinsSettings.locale;
  if (
    first == null &&
    defaultLanguageId &&
    defaultLanguageId !== channelVars.languageId
  ) {
    return unwrapGraphQL(await runQuery(defaultLanguageId));
  }
  return first;
}

/**
 * Fetch multiple products by alias in parallel. Failures and null results are
 * omitted — callers get the set that resolved. Used by /api/products/by-aliases
 * to hydrate client-only favorites lists without failing the whole batch when
 * a single alias is stale or deleted.
 */
export async function getProductsByAliases(
  args: { aliases: string[]; userToken?: string },
  event: H3Event,
): Promise<unknown[]> {
  const results = await Promise.allSettled(
    args.aliases.map((alias) =>
      getProduct({ alias, userToken: args.userToken }, event),
    ),
  );
  return results
    .filter(
      (r): r is PromiseFulfilledResult<unknown> =>
        r.status === 'fulfilled' && r.value != null,
    )
    .map((r) => r.value);
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

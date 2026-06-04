import type { H3Event } from 'h3';
import { getTenantSDK, getRequestChannelVariables } from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';
import { resolveWithLocaleFallback } from './_locale-fallback';

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

/**
 * Resolve many products by product ID in a single GraphQL call.
 *
 * The Geins `products(filter: { productIds })` query returns every match in one
 * request (up to 600 ids, sorted in input order) instead of N per-alias fetches.
 * `includeCollapsed: true` is required because variant siblings are collapsed
 * out of normal product listings. Used to hydrate the PDP variant sheet, where a
 * product can have dozens of siblings, far more than a per-alias fan-out can
 * carry without timing out or blowing the request size. Returns the slim
 * `productsByIds` payload (name + articleNumber + price, no nested variantGroup).
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

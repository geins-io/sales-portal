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
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('products/product.graphql'),
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

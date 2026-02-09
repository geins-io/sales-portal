import type { H3Event } from 'h3';
import { getTenantSDK, getChannelVariables } from './_sdk';
import { loadQuery } from './graphql/loader';

/**
 * Product services — direct GraphQL via @geins/core.
 * When an SDK package covers this domain, swap the implementation here.
 * API routes won't need to change.
 */

export async function getProduct(
  args: { alias: string },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  return sdk.core.graphql.query({
    queryAsString: loadQuery('products/product.graphql'),
    variables: { alias: args.alias, ...getChannelVariables(sdk) },
  });
}

export async function getRelatedProducts(
  args: { alias: string },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  return sdk.core.graphql.query({
    queryAsString: loadQuery('products/related-products.graphql'),
    variables: { alias: args.alias, ...getChannelVariables(sdk) },
  });
}

export async function getReviews(
  args: { alias: string; skip?: number; take?: number },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  return sdk.core.graphql.query({
    queryAsString: loadQuery('products/reviews.graphql'),
    variables: { ...args, ...getChannelVariables(sdk) },
  });
}

export async function getPriceHistory(
  args: { alias: string },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  return sdk.core.graphql.query({
    queryAsString: loadQuery('products/price-history.graphql'),
    variables: { alias: args.alias, ...getChannelVariables(sdk) },
  });
}

export async function postReview(
  args: { alias: string; rating: number; author: string; comment?: string },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  return sdk.core.graphql.mutation({
    queryAsString: loadQuery('products/post-review.graphql'),
    variables: { ...args, ...getChannelVariables(sdk) },
  });
}

export async function monitorAvailability(
  args: { email: string; skuId: number },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  return sdk.core.graphql.mutation({
    queryAsString: loadQuery('products/monitor-availability.graphql'),
    variables: { ...args, ...getChannelVariables(sdk) },
  });
}

import type { H3Event } from 'h3';
import { getTenantSDK, getRequestChannelVariables } from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';

export interface ProductListOptions {
  skip?: number;
  take?: number;
  categoryAlias?: string;
  brandAlias?: string;
  discountCampaignAlias?: string;
  url?: string;
  filter?: Record<string, unknown>;
}

export async function getProducts(
  options: ProductListOptions,
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('product-lists/products.graphql'),
        variables: { ...options, ...getRequestChannelVariables(sdk, event) },
      }),
    'product-lists',
  );
  return unwrapGraphQL(result);
}

export async function getFilters(
  options: ProductListOptions,
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('product-lists/list-filters.graphql'),
        variables: { ...options, ...getRequestChannelVariables(sdk, event) },
      }),
    'product-lists',
  );
  return unwrapGraphQL(result);
}

export async function getCategoryPage(
  args: { alias: string },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('product-lists/category-page.graphql'),
        variables: {
          alias: args.alias,
          ...getRequestChannelVariables(sdk, event),
        },
      }),
    'product-lists',
  );
  return unwrapGraphQL(result);
}

export async function getBrandPage(
  args: { alias: string },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('product-lists/brand-page.graphql'),
        variables: {
          alias: args.alias,
          ...getRequestChannelVariables(sdk, event),
        },
      }),
    'product-lists',
  );
  return unwrapGraphQL(result);
}

export async function getDiscountCampaignPage(
  args: { alias: string },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery(
          'product-lists/discount-campaign-page.graphql',
        ),
        variables: {
          alias: args.alias,
          ...getRequestChannelVariables(sdk, event),
        },
      }),
    'product-lists',
  );
  return unwrapGraphQL(result);
}

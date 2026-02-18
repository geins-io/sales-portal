import type { H3Event } from 'h3';
import { getTenantSDK, getRequestChannelVariables } from './_sdk';
import { loadQuery } from './graphql/loader';

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
  return wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('product-lists/products.graphql'),
        variables: { ...options, ...getRequestChannelVariables(sdk, event) },
      }),
    'product-lists',
  );
}

export async function getFilters(
  options: ProductListOptions,
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  return wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('product-lists/list-filters.graphql'),
        variables: { ...options, ...getRequestChannelVariables(sdk, event) },
      }),
    'product-lists',
  );
}

export async function getCategoryPage(
  args: { alias: string },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  return wrapServiceCall(
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
}

export async function getBrandPage(
  args: { alias: string },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  return wrapServiceCall(
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
}

export async function getDiscountCampaignPage(
  args: { alias: string },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  return wrapServiceCall(
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
}

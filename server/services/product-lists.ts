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
  userToken?: string;
}

export async function getProducts(
  options: ProductListOptions,
  event: H3Event,
): Promise<unknown> {
  const { userToken, ...variables } = options;
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('product-lists/products.graphql'),
        variables: { ...variables, ...getRequestChannelVariables(sdk, event) },
        userToken,
      }),
    'product-lists',
  );
  return unwrapGraphQL(result);
}

export async function getFilters(
  options: ProductListOptions,
  event: H3Event,
): Promise<unknown> {
  const { userToken, ...variables } = options;
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('product-lists/list-filters.graphql'),
        variables: { ...variables, ...getRequestChannelVariables(sdk, event) },
        userToken,
      }),
    'product-lists',
  );
  return unwrapGraphQL(result);
}

export async function getCategoryPage(
  args: { alias: string; userToken?: string },
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
        userToken: args.userToken,
      }),
    'product-lists',
  );
  return unwrapGraphQL(result);
}

export async function getBrandPage(
  args: { alias: string; userToken?: string },
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
        userToken: args.userToken,
      }),
    'product-lists',
  );
  return unwrapGraphQL(result);
}

export async function getDiscountCampaignPage(
  args: { alias: string; userToken?: string },
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
        userToken: args.userToken,
      }),
    'product-lists',
  );
  return unwrapGraphQL(result);
}

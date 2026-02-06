import type { H3Event } from 'h3';
import { getGeinsClient, getChannelVariables } from './_client';
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
  const client = await getGeinsClient(event);
  return client.core.graphql.query({
    queryAsString: loadQuery('product-lists/products.graphql'),
    variables: { ...options, ...getChannelVariables(client) },
  });
}

export async function getFilters(
  options: ProductListOptions,
  event: H3Event,
): Promise<unknown> {
  const client = await getGeinsClient(event);
  return client.core.graphql.query({
    queryAsString: loadQuery('product-lists/list-filters.graphql'),
    variables: { ...options, ...getChannelVariables(client) },
  });
}

export async function getCategoryPage(
  args: { alias: string },
  event: H3Event,
): Promise<unknown> {
  const client = await getGeinsClient(event);
  return client.core.graphql.query({
    queryAsString: loadQuery('product-lists/category-page.graphql'),
    variables: { alias: args.alias, ...getChannelVariables(client) },
  });
}

export async function getBrandPage(
  args: { alias: string },
  event: H3Event,
): Promise<unknown> {
  const client = await getGeinsClient(event);
  return client.core.graphql.query({
    queryAsString: loadQuery('product-lists/brand-page.graphql'),
    variables: { alias: args.alias, ...getChannelVariables(client) },
  });
}

export async function getDiscountCampaignPage(
  args: { alias: string },
  event: H3Event,
): Promise<unknown> {
  const client = await getGeinsClient(event);
  return client.core.graphql.query({
    queryAsString: loadQuery('product-lists/discount-campaign-page.graphql'),
    variables: { alias: args.alias, ...getChannelVariables(client) },
  });
}

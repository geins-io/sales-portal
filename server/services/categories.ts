import type { H3Event } from 'h3';
import { getTenantSDK, getChannelVariables } from './_sdk';
import { loadQuery } from './graphql/loader';

export async function getCategories(event: H3Event): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  return sdk.core.graphql.query({
    queryAsString: loadQuery('categories/categories.graphql'),
    variables: getChannelVariables(sdk),
  });
}

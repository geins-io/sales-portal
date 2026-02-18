import type { H3Event } from 'h3';
import { getTenantSDK, getRequestChannelVariables } from './_sdk';
import { loadQuery } from './graphql/loader';

export async function getCategories(event: H3Event): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  return wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('categories/categories.graphql'),
        variables: getRequestChannelVariables(sdk, event),
      }),
    'categories',
  );
}

import type { H3Event } from 'h3';
import { getTenantSDK, getRequestChannelVariables } from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';

export async function getCategories(event: H3Event): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('categories/categories.graphql'),
        variables: getRequestChannelVariables(sdk, event),
      }),
    'categories',
  );
  return unwrapGraphQL(result);
}

import type { H3Event } from 'h3';
import { getTenantSDK, getRequestChannelVariables } from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';

export async function searchProducts(
  args: { filter: Record<string, unknown> },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('search/search.graphql'),
        variables: {
          filter: args.filter,
          ...getRequestChannelVariables(sdk, event),
        },
      }),
    'search',
  );
  return unwrapGraphQL(result);
}

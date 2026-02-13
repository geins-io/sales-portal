import type { H3Event } from 'h3';
import { getTenantSDK, getRequestChannelVariables } from './_sdk';
import { loadQuery } from './graphql/loader';

export async function searchProducts(
  args: { filter: Record<string, unknown> },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  return sdk.core.graphql.query({
    queryAsString: loadQuery('search/search.graphql'),
    variables: {
      filter: args.filter,
      ...getRequestChannelVariables(sdk, event),
    },
  });
}

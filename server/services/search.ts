import type { H3Event } from 'h3';
import { getGeinsClient, getChannelVariables } from './_client';
import { loadQuery } from './graphql/loader';

export async function searchProducts(
  args: { filter: Record<string, unknown> },
  event: H3Event,
): Promise<unknown> {
  const client = await getGeinsClient(event);
  return client.core.graphql.query({
    queryAsString: loadQuery('search/search.graphql'),
    variables: { filter: args.filter, ...getChannelVariables(client) },
  });
}

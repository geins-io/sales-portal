import type { H3Event } from 'h3';
import { getGeinsClient, getChannelVariables } from './_client';
import { loadQuery } from './graphql/loader';

export async function getCategories(event: H3Event): Promise<unknown> {
  const client = await getGeinsClient(event);
  return client.core.graphql.query({
    queryAsString: loadQuery('categories/categories.graphql'),
    variables: getChannelVariables(client),
  });
}

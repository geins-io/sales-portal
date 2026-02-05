import type { H3Event } from 'h3';
import { getGeinsClient, getChannelVariables } from './_client';
import { loadQuery } from './graphql/loader';

export async function getBrands(event: H3Event): Promise<unknown> {
  const client = await getGeinsClient(event);
  return client.core.graphql.query({
    queryAsString: loadQuery('brands/brands.graphql'),
    variables: getChannelVariables(client),
  });
}

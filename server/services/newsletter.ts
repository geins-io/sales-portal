import type { H3Event } from 'h3';
import { getGeinsClient, getChannelVariables } from './_client';
import { loadQuery } from './graphql/loader';

export async function subscribe(
  args: { email: string },
  event: H3Event,
): Promise<unknown> {
  const client = await getGeinsClient(event);
  return client.core.graphql.mutation({
    queryAsString: loadQuery('newsletter/subscribe.graphql'),
    variables: { email: args.email, ...getChannelVariables(client) },
  });
}

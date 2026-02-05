import type { H3Event } from 'h3';
import { getGeinsClient } from './_client';
import { loadQuery } from './graphql/loader';

export async function getChannel(event: H3Event): Promise<unknown> {
  const client = await getGeinsClient(event);
  const settings = client.core.geinsSettings;
  const channelId = `${settings.channel}|${settings.tld}`;
  return client.core.graphql.query({
    queryAsString: loadQuery('channels/channel.graphql'),
    variables: { channelId },
  });
}

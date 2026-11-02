import type { H3Event } from 'h3';
import { getTenantSDK } from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';

export async function getChannel(event: H3Event): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  const settings = sdk.core.geinsSettings;
  const channelId = `${settings.channel}|${settings.tld}`;
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('channels/channel.graphql'),
        variables: { channelId },
      }),
    'channels',
  );
  return unwrapGraphQL(result);
}

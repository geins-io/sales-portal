import type { H3Event } from 'h3';
import { getTenantSDK, getRequestChannelVariables } from './_sdk';
import { loadQuery } from './graphql/loader';

export async function subscribe(
  args: { email: string },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  return sdk.core.graphql.mutation({
    queryAsString: loadQuery('newsletter/subscribe.graphql'),
    variables: { email: args.email, ...getRequestChannelVariables(sdk, event) },
  });
}

import type { H3Event } from 'h3';
import { getTenantSDK, getRequestChannelVariables } from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';

export async function subscribe(
  args: { email: string },
  event: H3Event,
): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.mutation({
        queryAsString: loadQuery('newsletter/subscribe.graphql'),
        variables: {
          email: args.email,
          ...getRequestChannelVariables(sdk, event),
        },
      }),
    'newsletter',
  );
  return unwrapGraphQL(result);
}

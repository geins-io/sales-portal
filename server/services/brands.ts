import type { H3Event } from 'h3';
import { getTenantSDK, getRequestChannelVariables } from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';

export async function getBrands(event: H3Event): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('brands/brands.graphql'),
        variables: getRequestChannelVariables(sdk, event),
      }),
    'brands',
  );
  return unwrapGraphQL(result);
}

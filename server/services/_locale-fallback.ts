import type { H3Event } from 'h3';
import {
  getTenantSDK,
  getRequestChannelVariables,
  type TenantSDK,
} from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';

interface FallbackArgs<TVars extends Record<string, unknown>> {
  /** Path passed to `loadQuery`, e.g. `'products/product.graphql'`. */
  queryPath: string;
  /** Per-call query variables merged with the channel context. */
  variables: TVars;
  /** Service tag forwarded to `wrapServiceCall` for error tracing. */
  serviceName: string;
  /** Optional user token for authenticated queries. */
  userToken?: string;
}

/**
 * Runs a GraphQL alias lookup in the requested locale and silently retries
 * in the tenant's default locale when the first call returns null.
 *
 * Geins's per-language alias queries (`product`, `categoryByAlias`,
 * `brandByAlias`, etc.) return null when the entity is not published in the
 * requested language. Without this helper a language switch would 404 every
 * time the target locale has no entry for the current alias. With it, the
 * PDP / PLP renders default-language content under the original URL, the
 * client-side `replaceState` corrects the URL when the canonical URL stays
 * in the requested locale, and the user is never dropped on a 404 just
 * because they switched language.
 *
 * Centralised here so every alias-resolving service composes the same
 * fallback. Add a new caller by constructing the `FallbackArgs` and calling
 * `resolveWithLocaleFallback`. No service should reimplement this logic.
 */
export async function resolveWithLocaleFallback<
  TVars extends Record<string, unknown>,
>(args: FallbackArgs<TVars>, event: H3Event): Promise<unknown> {
  const sdk = await getTenantSDK(event);
  const channelVars = getRequestChannelVariables(sdk, event);
  const queryAsString = loadQuery(args.queryPath);

  const run = (languageId: string) =>
    runQuery(sdk, queryAsString, args, channelVars, languageId);

  const first = unwrapGraphQL(await run(channelVars.languageId));

  const defaultLanguageId = sdk.core.geinsSettings.locale;
  if (
    first == null &&
    defaultLanguageId &&
    defaultLanguageId !== channelVars.languageId
  ) {
    return unwrapGraphQL(await run(defaultLanguageId));
  }
  return first;
}

function runQuery<TVars extends Record<string, unknown>>(
  sdk: TenantSDK,
  queryAsString: string,
  args: FallbackArgs<TVars>,
  channelVars: { channelId: string; languageId: string; marketId: string },
  languageId: string,
): Promise<unknown> {
  return wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString,
        variables: { ...args.variables, ...channelVars, languageId },
        userToken: args.userToken,
      }),
    args.serviceName,
  );
}

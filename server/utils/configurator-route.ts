import type { H3Event } from 'h3';
import {
  buildConfiguratorContext,
  getConfiguratorBackend,
  type ConfiguratorBackend,
  type ConfiguratorContext,
} from '../services/configurator';
import { canAccessFeatureServer } from './feature-access';

// ---------------------------------------------------------------------------
// What every configuration route does before it does anything else.
//
// Written once rather than six times: the gate is the part that must not drift
// between the routes, and it is checked before any body is read so that a
// tenant without the feature answers the same 404 to a malformed request as to
// a well-formed one.
// ---------------------------------------------------------------------------

export interface ConfiguratorRoute {
  backend: ConfiguratorBackend;
  ctx: ConfiguratorContext;
}

export async function requireConfigurator(
  event: H3Event,
): Promise<ConfiguratorRoute> {
  // A configuration is per session and priced per customer.
  setResponseHeader(event, 'Cache-Control', 'private, no-store');

  const allowed = await canAccessFeatureServer(event, 'configurator', {
    authenticated: !!getSessionToken(event),
  });
  if (!allowed) {
    // 404 rather than 403, for the access rule as well as for the flag: a
    // request that may not have the feature is not told that it exists.
    throw createAppError(ErrorCode.NOT_FOUND, 'No configurator on this tenant');
  }

  if (event.context.tenant?.config?.mode === 'catalog') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Not available in catalogue mode',
    });
  }

  return {
    backend: getConfiguratorBackend(event),
    ctx: buildConfiguratorContext(event),
  };
}

/**
 * An absent id is handed to the backend as an empty one, which answers the
 * ordinary 404. Nitro cannot route a request here without it; inventing a
 * second error path for the impossible case would only add one nothing tests.
 */
export function configurationIdFrom(event: H3Event): string {
  return getRouterParam(event, 'id') ?? '';
}

import type { H3Event } from 'h3';
import { canAccessFeature, canConfigure } from '#shared/utils/feature-access';
import type { UserContext } from '#shared/utils/feature-access';
import { getFeatures } from '../services/tenant-config';
import { optionalAuth, requireAuth } from './auth';
import type { AuthTokens } from './session';

/**
 * Check if a user can access a feature, evaluating both `.enabled` and `.access` rules.
 * Reads features from the tenant config resolved via the request event.
 *
 * @param user - Defaults to `{ authenticated: false }` if not provided.
 */
export async function canAccessFeatureServer(
  event: H3Event,
  featureName: string,
  user: UserContext = { authenticated: false },
): Promise<boolean> {
  const features = await getFeatures(event);
  return canAccessFeature(features?.[featureName], user);
}

/** Whether this request may configure products: see `canConfigure`. */
export async function canConfigureServer(event: H3Event): Promise<boolean> {
  return canConfigure({ authenticated: !!getSessionToken(event) });
}

/**
 * Assert that a user can access a feature. Throws 403 if access is denied.
 *
 * @example
 * ```ts
 * await assertFeatureAccess(event, 'quotes', {
 *   authenticated: !!getSessionToken(event),
 * });
 * ```
 */
export async function assertFeatureAccess(
  event: H3Event,
  featureName: string,
  user: UserContext = { authenticated: false },
): Promise<void> {
  const allowed = await canAccessFeatureServer(event, featureName, user);
  if (!allowed) {
    throw createError({
      statusCode: 403,
      message: `Access denied: feature "${featureName}" is not available`,
    });
  }
}

/**
 * The session for a route behind a feature: optional when the feature is
 * enabled with `access: 'all'`, required otherwise. Only that explicit rule
 * opens the route; a stored feature without a rule keeps requiring sign-in.
 */
export async function sessionForFeature(
  event: H3Event,
  featureName: string,
): Promise<AuthTokens | null> {
  const feature = (await getFeatures(event))?.[featureName];
  const open = feature?.enabled === true && feature.access === 'all';
  return open ? optionalAuth(event) : requireAuth(event);
}

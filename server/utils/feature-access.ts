import type { H3Event } from 'h3';
import { canAccessFeature } from '#shared/utils/feature-access';
import type { UserContext } from '#shared/utils/feature-access';
import { getFeatures } from '../services/tenant-config';

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

/**
 * Assert that a user can access a feature. Throws 403 if access is denied.
 *
 * @example
 * ```ts
 * const tokens = await optionalAuth(event);
 * await assertFeatureAccess(event, 'quotes', { authenticated: !!tokens });
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

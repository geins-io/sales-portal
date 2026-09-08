import type { FeatureAccess } from '#shared/types/tenant-config';

export interface UserContext {
  authenticated: boolean;
}

/**
 * Deny a rule the switch below does not handle.
 *
 * The `never` parameter is the guarantee: a member added to `FeatureAccess`
 * without a case fails `pnpm typecheck` here.
 *
 * It denies rather than throws because `FeatureAccessSchema` is a separate
 * source of truth, so a literal added only to the schema reaches this branch at
 * runtime and a throw would make it a 500 on both client and server.
 */
function denyUnhandledRule(rule: never): false {
  // `rule` is unusable by construction and shared/ carries no logger.
  void rule;
  return false;
}

/**
 * Evaluate a single access rule against user context.
 *
 * Exhaustive over `FeatureAccess`: adding a member means adding a case here.
 * Anything else denies.
 */
export function evaluateAccess(
  rule: FeatureAccess,
  user: UserContext,
): boolean {
  switch (rule) {
    case 'all':
      return true;

    case 'authenticated':
      return user.authenticated;

    default:
      return denyUnhandledRule(rule);
  }
}

/**
 * Check if a user can access a feature, considering both `.enabled` and `.access`.
 *
 * - Feature missing → false
 * - `!enabled` → false
 * - No `access` field → true (default: everyone)
 * - Otherwise, evaluate the access rule
 */
export function canAccessFeature(
  feature: { enabled: boolean; access?: FeatureAccess } | undefined,
  user: UserContext,
): boolean {
  if (!feature) return false;
  if (!feature.enabled) return false;
  if (!feature.access) return true;
  return evaluateAccess(feature.access, user);
}

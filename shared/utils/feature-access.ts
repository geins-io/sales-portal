import type { FeatureAccess } from '#shared/types/tenant-config';

export interface UserContext {
  authenticated: boolean;
  customerType?: string;
}

type RuleEvaluator = (rule: FeatureAccess, user: UserContext) => boolean | null;

/**
 * Ordered list of rule evaluators. First non-null result wins.
 * Adding a new access type = adding one evaluator function here.
 */
const evaluators: RuleEvaluator[] = [
  // 'all' — everyone can access
  (rule) => (rule === 'all' ? true : null),

  // 'authenticated' — logged-in users only
  (rule, user) => (rule === 'authenticated' ? user.authenticated : null),

  // { role } — matches user's customerType from Geins
  (rule, user) => {
    if (typeof rule === 'object' && 'role' in rule) {
      return user.customerType === rule.role;
    }
    return null;
  },

  // { group } — not available in Geins API yet, safe deny
  (rule) => {
    if (typeof rule === 'object' && 'group' in rule) {
      return false;
    }
    return null;
  },

  // { accountType } — not available in Geins API yet, safe deny
  (rule) => {
    if (typeof rule === 'object' && 'accountType' in rule) {
      return false;
    }
    return null;
  },
];

/**
 * Evaluate a single access rule against user context.
 * Returns the first non-null evaluator result, or false for unknown rules.
 */
export function evaluateAccess(
  rule: FeatureAccess,
  user: UserContext,
): boolean {
  for (const evaluator of evaluators) {
    const result = evaluator(rule, user);
    if (result !== null) return result;
  }
  return false;
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

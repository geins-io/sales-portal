/**
 * Find the tenant's own BCP-47 tag for a short locale code ('nb' -> 'nb-NO').
 *
 * The region tag is tenant-dependent and not stable — the same 'en' locale can
 * be 'en-GB' on one tenant and 'en-US' on another — so it must come from the
 * tenant's configured locales, never from the market segment or a hardcoded
 * table. Returns undefined when the tenant carries no locale with that prefix;
 * callers decide their own fallback.
 */
export function findTenantBcp47(
  short: string,
  availableLocales: readonly string[] | undefined,
): string | undefined {
  return availableLocales?.find((full) => full.split('-')[0] === short);
}

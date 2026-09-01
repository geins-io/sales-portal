import { isIsoRegion } from '#shared/constants/iso-regions';

/**
 * The tenant's own BCP-47 tag for a short locale code ('nb' -> 'nb-NO').
 *
 * The region is tenant-dependent — 'en' is 'en-GB' on one tenant, 'en-US' on
 * another — so it must come from tenant config, never a hardcoded table.
 * Undefined when no tenant locale carries the prefix; callers pick a fallback.
 */
export function findTenantBcp47(
  short: string,
  availableLocales: readonly string[] | undefined,
): string | undefined {
  return availableLocales?.find((full) => full.split('-')[0] === short);
}

/**
 * The hreflang value for a locale as served on a given market.
 *
 * hreflang's region subtag targets the AUDIENCE, not the language's home
 * region: 'nb-SE' means "Norwegian speakers in Sweden", which is what a
 * Norwegian page on the Swedish market is. The market binds catalog, prices
 * and currency (ADR-020), so it is the market that supplies the region.
 *
 * Market codes are free-form tenant config and need not be countries, so a
 * market only qualifies when it is an assigned ISO region — 'sv-EU' is not a
 * language tag. Otherwise fall back to the tenant's tag, then the short code.
 *
 * Deliberately not the `<html lang>` rule, which states the document's own
 * language and stays tenant-derived.
 */
export function hreflangFor(
  short: string,
  market: string | null | undefined,
  availableLocales: readonly string[] | undefined,
): string {
  if (market && isIsoRegion(market)) return `${short}-${market.toUpperCase()}`;
  return findTenantBcp47(short, availableLocales) ?? short;
}

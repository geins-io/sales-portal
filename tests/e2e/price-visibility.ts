/**
 * The `features` map of `/api/config`. The server disables a feature whose
 * access rule it cannot evaluate, so these two are the only rules it sends.
 */
type Features = Record<
  string,
  { enabled: boolean; access?: 'all' | 'authenticated' }
>;

/**
 * Whether a signed-out visitor sees prices on this tenant: `usePriceVisibility`
 * for a buyer who is not signed in. An unconfigured feature shows prices, a
 * disabled one hides them from everyone, and otherwise the access rule decides.
 *
 * Kept free of Playwright so the unit tier can hold it against the app's own
 * rule (tests/unit/e2e-price-visibility.test.ts).
 */
export function signedOutSeesPrices(features: Features | undefined): boolean {
  const feature = features?.priceVisibility;
  if (!feature) return true;
  if (!feature.enabled) return false;
  return feature.access === undefined || feature.access === 'all';
}

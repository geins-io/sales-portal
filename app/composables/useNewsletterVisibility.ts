// The single store-settings feature key that toggles the footer newsletter
// section. Centralized here so landing the backend setting is a one-line
// confirmation: if the merchant API names the flag differently, only this
// constant changes and every consumer follows.
export const NEWSLETTER_FEATURE_KEY = 'newsletterSignup';

/**
 * Visibility of the footer newsletter signup section.
 *
 * Uses the same configured-vs-enabled-vs-access reader chain as
 * `usePriceVisibility` / `useStockVisibility`. The newsletter flag has no
 * access dimension today (the backend sends a pure on/off, either as a bare
 * boolean or `{ enabled }`, both normalizing to `{ enabled }` at the schema
 * boundary), so an absent key shows by default, `enabled: false` hides, and an
 * `enabled: true` with any future `access` rule defers to `canAccess`.
 */
export function useNewsletterVisibility() {
  const { isFeatureConfigured, hasFeature } = useTenant();
  const { canAccess } = useFeatureAccess();

  const showNewsletter = computed(() => {
    if (!isFeatureConfigured(NEWSLETTER_FEATURE_KEY)) return true;
    if (!hasFeature(NEWSLETTER_FEATURE_KEY)) return false;
    return canAccess(NEWSLETTER_FEATURE_KEY);
  });

  return { showNewsletter };
}

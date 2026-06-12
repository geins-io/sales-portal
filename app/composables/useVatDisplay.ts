import { COOKIE_NAMES } from '#shared/constants/storage';

/**
 * Composable for user preference: show prices inclusive or exclusive of VAT.
 *
 * Cookie-backed and SSR-safe. Reads via useCookie so the first server render
 * matches the stored choice without a hydration flash.
 *
 * Default is ex-VAT: business buyers see prices excluding VAT until they opt
 * into inclusive display via the switcher.
 */
export function useVatDisplay() {
  const cookie = useCookie<'inc' | 'ex'>(COOKIE_NAMES.VAT_DISPLAY, {
    maxAge: 365 * 24 * 60 * 60,
    default: () => 'ex',
  });

  /** True when the user wants prices shown inclusive of VAT (ex-VAT is the default). */
  const showIncVat = computed(() => cookie.value === 'inc');

  function setShowIncVat(inc: boolean) {
    cookie.value = inc ? 'inc' : 'ex';
  }

  function toggle() {
    setShowIncVat(!showIncVat.value);
  }

  return { showIncVat, setShowIncVat, toggle };
}

import { COOKIE_NAMES } from '#shared/constants/storage';

/**
 * Composable for user preference: show prices inclusive or exclusive of VAT.
 *
 * Cookie-backed and SSR-safe — reads via useCookie so the first server render
 * matches the stored choice without a hydration flash.
 *
 * Default is incl-VAT (preserves existing PriceDisplay behavior).
 */
export function useVatDisplay() {
  const cookie = useCookie<'inc' | 'ex'>(COOKIE_NAMES.VAT_DISPLAY, {
    maxAge: 365 * 24 * 60 * 60,
    default: () => 'inc',
  });

  /** True when the user wants prices shown inclusive of VAT (the default). */
  const showIncVat = computed(() => cookie.value !== 'ex');

  function setShowIncVat(inc: boolean) {
    cookie.value = inc ? 'inc' : 'ex';
  }

  function toggle() {
    setShowIncVat(!showIncVat.value);
  }

  return { showIncVat, setShowIncVat, toggle };
}

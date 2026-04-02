import { COOKIE_NAMES } from '#shared/constants/storage';

export function useCmsPreview() {
  const previewCookie = useCookie<boolean | string | null>(
    COOKIE_NAMES.PREVIEW_MODE,
  );
  // useCookie decodes 'true' → boolean true via destr
  const isPreview = computed(
    () => previewCookie.value === true || previewCookie.value === 'true',
  );

  async function exitPreview() {
    try {
      await $fetch('/api/auth/preview-exit', { method: 'POST' });
    } catch {
      // Best-effort — still clear client state
    }
    previewCookie.value = null;
    // Full page reload so the server re-renders without preview cookies
    // Client-side navigateTo would reuse cached (broken) CMS data
    const { localePath: getLocalePath } = useLocaleMarket();
    await navigateTo(getLocalePath('/'), { replace: true, external: true });
  }

  return { isPreview, exitPreview };
}

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
    await navigateTo('/', { replace: true });
  }

  return { isPreview, exitPreview };
}

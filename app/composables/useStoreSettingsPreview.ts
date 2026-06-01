import { COOKIE_NAMES } from '#shared/constants/storage';

export function useStoreSettingsPreview() {
  const previewCookie = useCookie<boolean | string | null>(
    COOKIE_NAMES.STORE_SETTINGS_PREVIEW,
  );
  // useCookie decodes 'true' to boolean true via destr
  const isPreview = computed(
    () => previewCookie.value === true || previewCookie.value === 'true',
  );

  async function exitPreview() {
    try {
      await $fetch('/api/auth/store-settings-preview-exit', { method: 'POST' });
    } catch {
      // Best-effort: still clear client state on network failure
    }
    previewCookie.value = null;
    // Full page reload so SSR re-renders with live tenant config.
    // Client-side navigateTo would reuse cached preview config.
    const { localePath: getLocalePath } = useLocaleMarket();
    await navigateTo(getLocalePath('/'), { replace: true, external: true });
  }

  return { isPreview, exitPreview };
}

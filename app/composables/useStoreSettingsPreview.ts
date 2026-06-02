export function useStoreSettingsPreview() {
  const route = useRoute();
  const isPreview = computed(() => route.query.preview === '1');

  async function exitPreview() {
    const { localePath: getLocalePath } = useLocaleMarket();
    // Hard navigate to a path without ?preview=1 so SSR re-renders live config.
    // Client-side navigateTo would reuse cached preview config.
    await navigateTo(getLocalePath('/'), { replace: true, external: true });
  }

  return { isPreview, exitPreview };
}

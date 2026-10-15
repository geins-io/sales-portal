export function useStoreSettingsPreview() {
  const route = useRoute();
  const isPreview = computed(() => route.query.preview === '1');
  const { localePath } = useLocaleMarket();

  async function exitPreview() {
    // Hard navigate to a path without ?preview=1 so SSR re-renders live config.
    // Client-side navigateTo would reuse cached preview config.
    await navigateTo(localePath('/'), { replace: true, external: true });
  }

  return { isPreview, exitPreview };
}

import { COOKIE_NAMES } from '#shared/constants/storage';
import { useAuthStore } from '~/stores/auth';

export function useImpersonation() {
  const spoofedBy = useCookie<string | null>(COOKIE_NAMES.SPOOFED_BY);
  const isImpersonating = computed(() => !!spoofedBy.value);

  const authStore = useAuthStore();
  const customerName = computed(() => authStore.displayName ?? '');

  async function exitImpersonation() {
    spoofedBy.value = null;
    await authStore.logout();
    const { localePath: getLocalePath } = useLocaleMarket();
    await navigateTo(getLocalePath('/'), { replace: true, external: true });
  }

  return { isImpersonating, spoofedBy, customerName, exitImpersonation };
}

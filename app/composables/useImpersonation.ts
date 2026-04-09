import { COOKIE_NAMES } from '#shared/constants/storage';
import { useAuthStore } from '~/stores/auth';

export function useImpersonation() {
  const spoofedBy = useCookie<string | null>(COOKIE_NAMES.SPOOFED_BY);
  const isImpersonating = computed(() => !!spoofedBy.value);

  const authStore = useAuthStore();
  const { localePath } = useLocaleMarket();
  const customerName = computed(() => authStore.displayName ?? '');

  async function exitImpersonation() {
    spoofedBy.value = null;
    await authStore.logout();
    // Full page reload to clear all cached state (matches PortalShell logout)
    navigateTo(localePath('/'), { external: true });
  }

  return { isImpersonating, spoofedBy, customerName, exitImpersonation };
}

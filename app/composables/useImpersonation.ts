import { COOKIE_NAMES } from '#shared/constants/storage';
import { useAuthStore } from '~/stores/auth';

export function useImpersonation() {
  const spoofedBy = useCookie<string | null>(COOKIE_NAMES.SPOOFED_BY);
  const isImpersonating = computed(() => !!spoofedBy.value);

  const authStore = useAuthStore();
  const { logout } = useLogout();
  const customerName = computed(() => authStore.displayName ?? '');

  async function exitImpersonation() {
    spoofedBy.value = null;
    await logout();
  }

  return { isImpersonating, spoofedBy, customerName, exitImpersonation };
}

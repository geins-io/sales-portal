import { useStorage } from '@vueuse/core';
import { LOCAL_STORAGE_KEYS } from '#shared/constants/storage';

/**
 * Per-tenant analytics consent state backed by localStorage.
 * Default is `false` — scripts never fire until explicit `accept()`.
 */
export function useAnalyticsConsent() {
  const { tenantId } = useTenant();
  const key = `${LOCAL_STORAGE_KEYS.ANALYTICS_CONSENT_PREFIX}${tenantId.value}`;

  const consent = useStorage(key, false);

  function accept() {
    consent.value = true;
  }

  function revoke() {
    consent.value = false;
  }

  return { consent, accept, revoke };
}

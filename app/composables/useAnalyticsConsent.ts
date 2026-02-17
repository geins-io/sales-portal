import { useStorage } from '@vueuse/core';
import { LOCAL_STORAGE_KEYS } from '#shared/constants/storage';

type ConsentState = 'accepted' | 'declined' | null;

/**
 * Per-tenant analytics consent state backed by localStorage.
 * Tri-state: `null` (no interaction), `'accepted'`, or `'declined'`.
 * The `consent` computed stays boolean for `useScriptTriggerConsent` compatibility.
 */
export function useAnalyticsConsent() {
  const { tenantId } = useTenant();
  const key = `${LOCAL_STORAGE_KEYS.ANALYTICS_CONSENT_PREFIX}${tenantId.value}`;

  const state = useStorage<ConsentState>(key, null);

  const consent = computed(() => state.value === 'accepted');
  const hasInteracted = computed(() => state.value !== null);

  function accept() {
    state.value = 'accepted';
  }

  function revoke() {
    state.value = 'declined';
  }

  return { consent, hasInteracted, accept, revoke };
}

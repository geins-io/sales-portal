import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime';

// useCookie decodes 'true' to boolean true via destr, so ref accepts both types
const mockCookieRef = ref<boolean | string | null>(null);
const navigateToMock = vi.fn();
const cmsExitHits = vi.fn();
const storeSettingsExitHits = vi.fn();

mockNuxtImport('useCookie', () => () => mockCookieRef);
mockNuxtImport(
  'navigateTo',
  () =>
    (...args: unknown[]) =>
      navigateToMock(...args),
);

registerEndpoint('/api/auth/store-settings-preview-exit', {
  method: 'POST',
  handler: () => {
    storeSettingsExitHits();
    return { success: true };
  },
});

registerEndpoint('/api/auth/preview-exit', {
  method: 'POST',
  handler: () => {
    cmsExitHits();
    return { success: true };
  },
});

describe('useStoreSettingsPreview', () => {
  let useStoreSettingsPreview: typeof import('../../app/composables/useStoreSettingsPreview').useStoreSettingsPreview;

  beforeEach(async () => {
    mockCookieRef.value = null;
    navigateToMock.mockClear();
    cmsExitHits.mockClear();
    storeSettingsExitHits.mockClear();

    vi.resetModules();
    const mod = await import('../../app/composables/useStoreSettingsPreview');
    useStoreSettingsPreview = mod.useStoreSettingsPreview;
  });

  it('isPreview is false when cookie ref is null', () => {
    mockCookieRef.value = null;
    const { isPreview } = useStoreSettingsPreview();
    expect(isPreview.value).toBe(false);
  });

  it('isPreview is true when cookie ref is boolean true', () => {
    mockCookieRef.value = true;
    const { isPreview } = useStoreSettingsPreview();
    expect(isPreview.value).toBe(true);
  });

  it('isPreview is true when cookie ref is string "true"', () => {
    mockCookieRef.value = 'true';
    const { isPreview } = useStoreSettingsPreview();
    expect(isPreview.value).toBe(true);
  });

  it('isPreview is false for other string values', () => {
    mockCookieRef.value = 'false';
    const { isPreview } = useStoreSettingsPreview();
    expect(isPreview.value).toBe(false);
  });

  it('exitPreview POSTs to /api/auth/store-settings-preview-exit', async () => {
    mockCookieRef.value = true;
    const { exitPreview } = useStoreSettingsPreview();
    await exitPreview();
    expect(storeSettingsExitHits).toHaveBeenCalledTimes(1);
  });

  it('exitPreview clears cookie ref to null', async () => {
    mockCookieRef.value = true;
    const { exitPreview } = useStoreSettingsPreview();
    await exitPreview();
    expect(mockCookieRef.value).toBeNull();
  });

  it('exitPreview navigates to localePath home with replace + external', async () => {
    mockCookieRef.value = true;
    const { exitPreview } = useStoreSettingsPreview();
    await exitPreview();
    expect(navigateToMock).toHaveBeenCalledWith('/se/en/', {
      replace: true,
      external: true,
    });
  });

  it('exitPreview tolerates fetch rejection and still clears + navigates', async () => {
    mockCookieRef.value = true;

    registerEndpoint('/api/auth/store-settings-preview-exit', {
      method: 'POST',
      handler: () => {
        throw new Error('server error');
      },
    });

    const { exitPreview } = useStoreSettingsPreview();
    await exitPreview();

    expect(mockCookieRef.value).toBeNull();
    expect(navigateToMock).toHaveBeenCalledWith('/se/en/', {
      replace: true,
      external: true,
    });
  });

  it('exitPreview never hits /api/auth/preview-exit (CMS preview isolation)', async () => {
    mockCookieRef.value = true;
    const { exitPreview } = useStoreSettingsPreview();
    await exitPreview();
    expect(cmsExitHits).not.toHaveBeenCalled();
  });
});

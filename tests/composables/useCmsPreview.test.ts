import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime';

// useCookie decodes 'true' → boolean true via destr, so ref accepts both types
const mockCookieRef = ref<boolean | string | null>(null);
const navigateToMock = vi.fn();

mockNuxtImport('useCookie', () => () => mockCookieRef);
mockNuxtImport(
  'navigateTo',
  () =>
    (...args: unknown[]) =>
      navigateToMock(...args),
);

registerEndpoint('/api/auth/preview-exit', {
  method: 'POST',
  handler: () => ({ success: true }),
});

describe('useCmsPreview', () => {
  let useCmsPreview: typeof import('../../app/composables/useCmsPreview').useCmsPreview;

  beforeEach(async () => {
    mockCookieRef.value = null;
    navigateToMock.mockClear();

    vi.resetModules();
    const mod = await import('../../app/composables/useCmsPreview');
    useCmsPreview = mod.useCmsPreview;
  });

  it('isPreview is true when cookie is string "true"', () => {
    mockCookieRef.value = 'true';
    const { isPreview } = useCmsPreview();
    expect(isPreview.value).toBe(true);
  });

  it('isPreview is true when cookie is boolean true (destr decoded)', () => {
    mockCookieRef.value = true;
    const { isPreview } = useCmsPreview();
    expect(isPreview.value).toBe(true);
  });

  it('isPreview is false when cookie is null', () => {
    mockCookieRef.value = null;
    const { isPreview } = useCmsPreview();
    expect(isPreview.value).toBe(false);
  });

  it('isPreview is false when cookie is some other value', () => {
    mockCookieRef.value = 'false';
    const { isPreview } = useCmsPreview();
    expect(isPreview.value).toBe(false);
  });

  it('exitPreview clears cookie and navigates home', async () => {
    mockCookieRef.value = true;
    const { exitPreview } = useCmsPreview();
    await exitPreview();

    expect(mockCookieRef.value).toBeNull();
    expect(navigateToMock).toHaveBeenCalledWith('/', { replace: true });
  });

  it('exitPreview still navigates even if fetch throws', async () => {
    mockCookieRef.value = true;

    registerEndpoint('/api/auth/preview-exit', {
      method: 'POST',
      handler: () => {
        throw new Error('server error');
      },
    });

    const { exitPreview } = useCmsPreview();
    await exitPreview();

    expect(mockCookieRef.value).toBeNull();
    expect(navigateToMock).toHaveBeenCalledWith('/', { replace: true });
  });
});

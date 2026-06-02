import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactive } from 'vue';
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime';

const mockRoute = reactive<{ query: Record<string, unknown> }>({ query: {} });
const navigateToMock = vi.fn();
const cmsExitHits = vi.fn();
const storeSettingsExitHits = vi.fn();

mockNuxtImport('useRoute', () => () => mockRoute);
mockNuxtImport('useLocaleMarket', () => () => ({
  localePath: (path: string) => `/se/en${path}`,
}));
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
    mockRoute.query = {};
    navigateToMock.mockClear();
    cmsExitHits.mockClear();
    storeSettingsExitHits.mockClear();

    vi.resetModules();
    const mod = await import('../../app/composables/useStoreSettingsPreview');
    useStoreSettingsPreview = mod.useStoreSettingsPreview;
  });

  it('isPreview is false when query.preview is undefined', () => {
    mockRoute.query = {};
    const { isPreview } = useStoreSettingsPreview();
    expect(isPreview.value).toBe(false);
  });

  it("isPreview is true when query.preview === '1'", () => {
    mockRoute.query = { preview: '1' };
    const { isPreview } = useStoreSettingsPreview();
    expect(isPreview.value).toBe(true);
  });

  it("isPreview is false for non-'1' query values", () => {
    mockRoute.query = { preview: '0' };
    const { isPreview } = useStoreSettingsPreview();
    expect(isPreview.value).toBe(false);
  });

  it('exitPreview navigates to localePath home with replace + external', async () => {
    mockRoute.query = { preview: '1' };
    const { exitPreview } = useStoreSettingsPreview();
    await exitPreview();
    expect(navigateToMock).toHaveBeenCalledWith('/se/en/', {
      replace: true,
      external: true,
    });
  });

  it('exitPreview never POSTs to /api/auth/store-settings-preview-exit', async () => {
    mockRoute.query = { preview: '1' };
    const { exitPreview } = useStoreSettingsPreview();
    await exitPreview();
    expect(storeSettingsExitHits).not.toHaveBeenCalled();
  });

  it('exitPreview never hits /api/auth/preview-exit (CMS preview isolation)', async () => {
    mockRoute.query = { preview: '1' };
    const { exitPreview } = useStoreSettingsPreview();
    await exitPreview();
    expect(cmsExitHits).not.toHaveBeenCalled();
  });
});

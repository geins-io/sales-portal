import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';

/**
 * The three `useScript*` composables are auto-imports, and in a test build they
 * do NOT resolve to `@nuxt/scripts`: Nuxt registers the real ones only when
 * `options.test === false`, and otherwise leaves its own stubs in place, which
 * throw "provided by @nuxt/scripts" the moment they are called. So the mock
 * target is `#app/composables/script-stubs`, the same shape as the
 * `#app/composables/head` mock in tenant-seo.test.ts.
 *
 * Mocking the package's own runtime files instead does not bite — the plugin
 * never imports them under test. Worth knowing before reaching for
 * `require.resolve`: the package root is not require-resolvable at all
 * (`@nuxt/scripts` exports only "." and "./registry"), so that route costs an
 * anchor-and-strip dance and then still mocks the wrong module.
 */
const mockUseScriptGoogleAnalytics = vi.fn();
const mockUseScriptGoogleTagManager = vi.fn();
const mockUseScriptTriggerConsent = vi.fn(() => 'trigger-sentinel');

vi.mock('#app/composables/script-stubs', () => ({
  useScriptTriggerConsent: mockUseScriptTriggerConsent,
  useScriptGoogleAnalytics: mockUseScriptGoogleAnalytics,
  useScriptGoogleTagManager: mockUseScriptGoogleTagManager,
}));

const tenantRef = ref<Record<string, unknown> | null>(null);
const mockHasFeature = vi.fn((_name: string) => true);
const analyticsKillSwitch = ref(true);

const mockUseTenant = vi.fn(() => ({
  tenant: tenantRef,
  hasFeature: mockHasFeature,
  tenantId: computed(() => 'example'),
  suspense: () => Promise.resolve(),
}));

type SetupFn = () => Promise<void>;
let capturedSetup: SetupFn | null = null;

vi.mock('#app/nuxt', () => ({
  defineNuxtPlugin: (definition: { name: string; setup: SetupFn }) => {
    capturedSetup = definition.setup;
    return definition;
  },
  useRuntimeConfig: () => ({
    public: { features: { analytics: analyticsKillSwitch.value } },
  }),
  tryUseNuxtApp: vi.fn(),
  useNuxtApp: vi.fn(),
}));

vi.mock('../../app/composables/useTenant', () => ({
  useTenant: mockUseTenant,
}));

vi.mock('../../app/composables/useAnalyticsConsent', () => ({
  useAnalyticsConsent: () => ({ consent: computed(() => true) }),
}));

await import('../../app/plugins/tenant-analytics');

/**
 * One literal `it` per config cell; the coverage map matches a reference title
 * verbatim against the spec source, so generated titles cannot be referenced.
 *
 * Every fixture below sets the *other* id. The plugin returns early on
 * `!gaId && !gtmId` (`tenant-analytics.ts:33`), so a fixture that leaves both
 * unset would make an "omits the script" assertion pass because the plugin
 * bailed out, not because the id was absent — green for the wrong reason.
 */
describe('tenant-analytics plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analyticsKillSwitch.value = true;
    mockHasFeature.mockImplementation(() => true);
    tenantRef.value = { isActive: true, seo: null };
  });

  async function withSeo(seo: Record<string, unknown>) {
    tenantRef.value = { isActive: true, seo };
    if (capturedSetup) await capturedSetup();
  }

  describe('seo.googleAnalyticsId', () => {
    it('omits the analytics script when googleAnalyticsId is absent', async () => {
      await withSeo({ googleTagManagerId: 'GTM-SENTINEL' });
      expect(mockUseScriptGoogleAnalytics).not.toHaveBeenCalled();
      // The plugin ran: the sibling id was registered.
      expect(mockUseScriptGoogleTagManager).toHaveBeenCalledTimes(1);
    });

    it('omits the analytics script when googleAnalyticsId is empty', async () => {
      await withSeo({
        googleAnalyticsId: '',
        googleTagManagerId: 'GTM-SENTINEL',
      });
      expect(mockUseScriptGoogleAnalytics).not.toHaveBeenCalled();
      expect(mockUseScriptGoogleTagManager).toHaveBeenCalledTimes(1);
    });

    it('registers the analytics script with the configured googleAnalyticsId', async () => {
      await withSeo({ googleAnalyticsId: 'GA-SENTINEL' });
      expect(mockUseScriptGoogleAnalytics).toHaveBeenCalledWith({
        id: 'GA-SENTINEL',
        scriptOptions: { trigger: 'trigger-sentinel' },
      });
    });
  });

  describe('seo.googleTagManagerId', () => {
    it('omits the tag manager script when googleTagManagerId is absent', async () => {
      await withSeo({ googleAnalyticsId: 'GA-SENTINEL' });
      expect(mockUseScriptGoogleTagManager).not.toHaveBeenCalled();
      expect(mockUseScriptGoogleAnalytics).toHaveBeenCalledTimes(1);
    });

    it('omits the tag manager script when googleTagManagerId is empty', async () => {
      await withSeo({
        googleAnalyticsId: 'GA-SENTINEL',
        googleTagManagerId: '',
      });
      expect(mockUseScriptGoogleTagManager).not.toHaveBeenCalled();
      expect(mockUseScriptGoogleAnalytics).toHaveBeenCalledTimes(1);
    });

    it('registers the tag manager script with the configured googleTagManagerId', async () => {
      await withSeo({ googleTagManagerId: 'GTM-SENTINEL' });
      expect(mockUseScriptGoogleTagManager).toHaveBeenCalledWith({
        id: 'GTM-SENTINEL',
        scriptOptions: { trigger: 'trigger-sentinel' },
      });
    });
  });

  /**
   * Not coverage cells — these are the gates in front of the two ids. They are
   * asserted because every fixture above depends on all of them being open, so
   * a change to any one of them would otherwise turn the six cells above green
   * for the wrong reason.
   */
  describe('the gates in front of the ids', () => {
    it('registers nothing when the runtime analytics kill switch is off', async () => {
      analyticsKillSwitch.value = false;
      await withSeo({
        googleAnalyticsId: 'GA-SENTINEL',
        googleTagManagerId: 'GTM-SENTINEL',
      });
      expect(mockUseScriptGoogleAnalytics).not.toHaveBeenCalled();
      expect(mockUseScriptGoogleTagManager).not.toHaveBeenCalled();
    });

    it('registers nothing when the tenant has the analytics feature disabled', async () => {
      mockHasFeature.mockImplementation((name) => name !== 'analytics');
      await withSeo({
        googleAnalyticsId: 'GA-SENTINEL',
        googleTagManagerId: 'GTM-SENTINEL',
      });
      expect(mockUseScriptGoogleAnalytics).not.toHaveBeenCalled();
      expect(mockUseScriptGoogleTagManager).not.toHaveBeenCalled();
    });

    it('registers nothing when the tenant is inactive', async () => {
      tenantRef.value = {
        isActive: false,
        seo: { googleAnalyticsId: 'GA-SENTINEL' },
      };
      if (capturedSetup) await capturedSetup();
      expect(mockUseScriptGoogleAnalytics).not.toHaveBeenCalled();
    });
  });
});

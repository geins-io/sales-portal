import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import type { ComputedRef } from 'vue';

// The locale ref is shared across all mocks so tests can flip it after plugin
// setup to simulate the post-middleware locale assignment on SSR.
const i18nLocale = ref('sv');

// Locale objects mirror nuxt.config i18n: short URL codes mapped to BCP-47
// `language` tags. The plugin reads `language` off these to render <html lang>.
const i18nLocales = ref<
  Array<{ code: string; language: string; name: string }>
>([
  { code: 'en', language: 'en', name: 'English' },
  { code: 'sv', language: 'sv-SE', name: 'Svenska' },
]);

// The plugin now registers two useHead entries: one for title/meta and one
// dedicated high-priority entry for htmlAttrs.lang. Capture every call and
// expose merged accessors so existing assertions (meta) and the new lang
// assertions both resolve against the right entry.
const capturedHeadArgs: Array<Record<string, unknown>> = [];
const mockUseHead = vi.fn((arg: Record<string, unknown>) => {
  capturedHeadArgs.push(arg);
});

// The last entry that carries htmlAttrs wins for <html lang> in unhead's merge.
function headEntryWithHtmlAttrs(): Record<string, unknown> {
  return [...capturedHeadArgs].reverse().find((a) => 'htmlAttrs' in a) ?? {};
}

// The entry that carries the reactive meta array (title/meta head call).
function headEntryWithMeta(): Record<string, unknown> {
  return [...capturedHeadArgs].reverse().find((a) => 'meta' in a) ?? {};
}

// Back-compat accessor: a merged view so legacy `capturedHeadArg.meta` /
// `capturedHeadArg.htmlAttrs` lookups keep working across the two calls.
const capturedHeadArg = new Proxy(
  {},
  {
    get(_t, prop: string) {
      if (prop === 'htmlAttrs') return headEntryWithHtmlAttrs().htmlAttrs;
      if (prop === 'meta') return headEntryWithMeta().meta;
      const last = capturedHeadArgs[capturedHeadArgs.length - 1] ?? {};
      return (last as Record<string, unknown>)[prop];
    },
    has(_t, prop: string) {
      return capturedHeadArgs.some((a) => prop in a);
    },
  },
) as Record<string, unknown>;

// Capture the input passed to useSchemaOrg.
let capturedSchemaOrgArg: unknown[] = [];
const mockUseSchemaOrg = vi.fn((input: unknown) => {
  capturedSchemaOrgArg = Array.isArray(input) ? input : [input];
});

// defineOrganization and defineWebSite are pass-through in tests so the raw
// schema objects end up in capturedSchemaOrgArg for assertion.
const mockDefineOrganization = vi.fn((schema: unknown) => schema);
const mockDefineWebSite = vi.fn((schema: unknown) => schema);

// Tenant mock - active with a default locale of 'sv-SE'.
const tenantRef = ref({
  isActive: true,
  locale: 'sv-SE',
  seo: null as null | Record<string, unknown>,
  contact: null as null | Record<string, unknown>,
  branding: { name: 'Test Store', logoUrl: '/logo.svg' },
  theme: { colors: { primary: '#000' } },
  hostname: 'test.example.com',
});

const mockUseTenant = vi.fn(() => ({
  tenant: tenantRef,
  brandName: computed(() => 'Test Store'),
  hostname: computed(() => 'test.example.com'),
  ogImageUrl: computed(() => null),
  suspense: () => Promise.resolve(),
}));

// defineNuxtPlugin - capture the setup function so tests can invoke it with a
// synthetic nuxtApp, avoiding the need for a real Nuxt instance.
type SetupFn = (nuxtApp: Record<string, unknown>) => Promise<void>;
let capturedSetup: SetupFn | null = null;
const mockDefineNuxtPlugin = vi.fn(
  (definition: { name: string; setup: SetupFn }) => {
    capturedSetup = definition.setup;
    return definition;
  },
);

// Mock the modules that Nuxt auto-imports compile to. The Nuxt Vite config
// rewrites `defineNuxtPlugin` -> `#app/nuxt`, `useHead` -> `#app/composables/head`,
// etc. vi.mock intercepts those module resolutions before the plugin loads.
vi.mock('#app/nuxt', () => ({
  defineNuxtPlugin: mockDefineNuxtPlugin,
  tryUseNuxtApp: vi.fn(),
  useNuxtApp: vi.fn(),
}));

vi.mock('#app/composables/head', () => ({
  useHead: mockUseHead,
  useHeadSafe: vi.fn(),
  useServerHead: vi.fn(),
  useServerHeadSafe: vi.fn(),
  useSeoMeta: vi.fn(),
  useServerSeoMeta: vi.fn(),
  injectHead: vi.fn(),
}));

vi.mock(
  '/home/ali.halaki/Projects/geins/url-404-fixes/node_modules/.pnpm/nuxt-schema-org@5.0.10_@unhead+vue@2.1.4_vue@3.5.28_typescript@5.9.3___magicast@0.5.2_u_b3ea5f4000fe1ffd41f4f55dfbec252e/node_modules/nuxt-schema-org/dist/runtime/app/composables/useSchemaOrg',
  () => ({ useSchemaOrg: mockUseSchemaOrg }),
);

vi.mock('@unhead/schema-org/vue', () => ({
  defineOrganization: mockDefineOrganization,
  defineWebSite: mockDefineWebSite,
  // stub the rest as no-ops so the import doesn't crash
  defineAddress: vi.fn(),
  defineAggregateOffer: vi.fn(),
  defineAggregateRating: vi.fn(),
  defineArticle: vi.fn(),
  defineBook: vi.fn(),
  defineBreadcrumb: vi.fn(),
  defineComment: vi.fn(),
  defineCourse: vi.fn(),
  defineEvent: vi.fn(),
  defineHowTo: vi.fn(),
  defineImage: vi.fn(),
  defineItemList: vi.fn(),
  defineLocalBusiness: vi.fn(),
  defineProduct: vi.fn(),
  defineRecipe: vi.fn(),
  defineReview: vi.fn(),
  defineWebPage: vi.fn(),
  useSchemaOrg: mockUseSchemaOrg,
}));

// Mock useTenant via its module path used by the plugin.
vi.mock('../../app/composables/useTenant', () => ({
  useTenant: mockUseTenant,
}));

// Import the plugin AFTER all vi.mock calls. Vitest hoists vi.mock to the top,
// so the stubs are in place when the module executes and registers its plugin.
await import('../../app/plugins/tenant-seo');

// Helper - run plugin setup with the given locale and return the nuxtApp used.
async function runSetup(overrideLocale?: string) {
  i18nLocale.value = overrideLocale ?? 'sv';
  capturedHeadArgs.length = 0;
  capturedSchemaOrgArg = [];
  mockUseHead.mockClear();
  mockUseSchemaOrg.mockClear();

  const nuxtApp = {
    $i18n: {
      locale: i18nLocale,
      locales: i18nLocales,
    },
  };

  if (capturedSetup) {
    await capturedSetup(nuxtApp as unknown as Record<string, unknown>);
  }
}

describe('tenant-seo plugin / reactive locale', () => {
  beforeEach(() => {
    tenantRef.value = {
      isActive: true,
      locale: 'sv-SE',
      seo: null,
      contact: null,
      branding: { name: 'Test Store', logoUrl: '/logo.svg' },
      theme: { colors: { primary: '#000' } },
      hostname: 'test.example.com',
    };
  });

  it('registers a plugin named tenant-seo via defineNuxtPlugin', () => {
    expect(capturedSetup).toBeTypeOf('function');
  });

  describe('htmlAttrs.lang is a getter (not a frozen string)', () => {
    it('htmlAttrs.lang is a function (reactive getter)', async () => {
      await runSetup('sv');
      const htmlAttrs = capturedHeadArg.htmlAttrs as Record<string, unknown>;
      expect(typeof htmlAttrs.lang).toBe('function');
    });

    it('the htmlAttrs head entry is registered with a numeric tagPriority that beats nuxt-seo-utils', async () => {
      await runSetup('en');
      // The second mockUseHead arg is the per-entry options bag. The htmlAttrs
      // entry must carry a numeric priority above nuxt-seo-utils' 'low' weight
      // (102) so it wins unhead's htmlAttrs merge on a hard SSR load.
      const htmlAttrsCall = mockUseHead.mock.calls.find(
        (call) =>
          call[0] && 'htmlAttrs' in (call[0] as Record<string, unknown>),
      );
      expect(htmlAttrsCall).toBeDefined();
      const options = htmlAttrsCall?.[1] as
        | { tagPriority?: number }
        | undefined;
      expect(typeof options?.tagPriority).toBe('number');
      expect(options?.tagPriority as number).toBeGreaterThan(102);
    });

    it('evaluating lang AFTER flipping i18n.locale to en yields the EN BCP-47 tag (render-time reactive)', async () => {
      // Plugin setup runs with locale 'sv' - simulates SSR before middleware.
      await runSetup('sv');

      const htmlAttrs = capturedHeadArg.htmlAttrs as Record<string, unknown>;
      const langGetter = htmlAttrs.lang as () => string;

      // At plugin-setup time the locale is still 'sv' -> BCP-47 'sv-SE'.
      expect(langGetter()).toBe('sv-SE');

      // Middleware fires and sets the URL locale to 'en'.
      i18nLocale.value = 'en';

      // A reactive getter re-reads the locale and maps to the 'en' locale
      // object's `language` ('en'); a stale capture would still return 'sv-SE'.
      expect(langGetter()).toBe('en');
    });

    it('lang getter yields the BCP-47 `language` of the locale set before setup', async () => {
      await runSetup('en');
      const htmlAttrs = capturedHeadArg.htmlAttrs as Record<string, unknown>;
      const langGetter = htmlAttrs.lang as () => string;
      // 'en' locale object declares language 'en'.
      expect(langGetter()).toBe('en');
    });

    it('lang getter maps the sv URL locale to its BCP-47 `language` sv-SE', async () => {
      await runSetup('sv');
      const htmlAttrs = capturedHeadArg.htmlAttrs as Record<string, unknown>;
      const langGetter = htmlAttrs.lang as () => string;
      // 'sv' locale object declares language 'sv-SE'.
      expect(langGetter()).toBe('sv-SE');
    });
  });

  describe('og:locale is reactive via computed meta', () => {
    it('meta passed to useHead is a computed ref (not a plain array)', async () => {
      await runSetup('sv');
      const meta = capturedHeadArg.meta;
      // A computed ref has a .value property and is not a plain Array.
      expect(meta).toBeDefined();
      // Verify it is ref-like (has a value property that is an array).
      expect(Array.isArray((meta as ComputedRef<unknown[]>).value)).toBe(true);
    });

    it('og:locale recomputes when i18n.locale is flipped to en after setup', async () => {
      await runSetup('sv');
      const meta = capturedHeadArg.meta as ComputedRef<
        Array<Record<string, string>>
      >;

      // At setup time locale is 'sv'.
      const ogLocaleAtSetup = meta.value.find(
        (m) => m.property === 'og:locale',
      );
      expect(ogLocaleAtSetup?.content).toBe('sv');

      // Flip locale to 'en' (simulates the route middleware running).
      i18nLocale.value = 'en';

      // The computed re-evaluates - og:locale should now reflect 'en'.
      const ogLocaleAfterFlip = meta.value.find(
        (m) => m.property === 'og:locale',
      );
      expect(ogLocaleAfterFlip?.content).toBe('en');
    });

    it('og:locale uses underscore format for locales with region codes', async () => {
      await runSetup('en-SE');
      const meta = capturedHeadArg.meta as ComputedRef<
        Array<Record<string, string>>
      >;
      const ogLocale = meta.value.find((m) => m.property === 'og:locale');
      expect(ogLocale?.content).toBe('en_SE');
    });
  });

  describe('fallback chain when locale is missing', () => {
    it('falls back to tenant.locale when i18n.locale is empty', async () => {
      // Set i18n.locale to empty string to trigger the fallback chain.
      await runSetup('');

      const htmlAttrs = capturedHeadArg.htmlAttrs as Record<string, unknown>;
      const langGetter = htmlAttrs.lang as () => string;
      // tenant.locale is 'sv-SE'. No locale object has code 'sv-SE' (codes are
      // the short 'en'/'sv'), so the BCP-47 mapping passes the value through.
      expect(langGetter()).toBe('sv-SE');
    });

    it('falls back to sv when both i18n.locale and tenant.locale are absent and maps to BCP-47 sv-SE', async () => {
      tenantRef.value = {
        ...tenantRef.value,
        locale: '',
      } as typeof tenantRef.value;

      await runSetup('');

      const htmlAttrs = capturedHeadArg.htmlAttrs as Record<string, unknown>;
      const langGetter = htmlAttrs.lang as () => string;
      // seoLocale falls back to 'sv', which maps to the sv locale object's
      // BCP-47 `language` of 'sv-SE'.
      expect(langGetter()).toBe('sv-SE');
    });
  });

  describe('inactive tenant', () => {
    it('does not call useHead when tenant is inactive', async () => {
      tenantRef.value = { ...tenantRef.value, isActive: false };
      mockUseHead.mockClear();
      const nuxtApp = { $i18n: { locale: i18nLocale } };
      if (capturedSetup) {
        await capturedSetup(nuxtApp as unknown as Record<string, unknown>);
      }
      expect(mockUseHead).not.toHaveBeenCalled();
    });
  });

  describe('webSiteSchema.inLanguage is reactive', () => {
    it('inLanguage in the webSite schema is a getter (not a frozen string)', async () => {
      await runSetup('sv');
      // capturedSchemaOrgArg is the array passed to useSchemaOrg.
      // Element [1] is the result of defineWebSite (our mock returns the input).
      const webSiteSchemaInput = capturedSchemaOrgArg[1] as Record<
        string,
        unknown
      >;
      // inLanguage should be a function (getter) so it resolves reactively.
      expect(typeof webSiteSchemaInput.inLanguage).toBe('function');
    });

    it('inLanguage getter reflects the current locale after a flip', async () => {
      await runSetup('sv');
      const webSiteSchemaInput = capturedSchemaOrgArg[1] as Record<
        string,
        unknown
      >;
      const inLangGetter = webSiteSchemaInput.inLanguage as () => string;

      expect(inLangGetter()).toBe('sv');

      i18nLocale.value = 'en';
      expect(inLangGetter()).toBe('en');
    });
  });
});

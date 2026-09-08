/**
 * Coverage map over `PublicTenantConfig`.
 *
 * One entry per value a tenant can configure, saying whether a test names that
 * value and — when none does — why not. It is data and types only: it re-tests
 * nothing, and where a test exists the entry points at it.
 *
 * Three statuses, and they claim only what is checkable:
 *
 *   - `has-test` — a spec and a title that exist. Whether the assertion inside
 *     is correct, or asserts the right thing, is not something this map knows.
 *   - `no-test` — a consumer exists, named as `file:line`, and nothing asserts
 *     it. Someone writes a test.
 *   - `no-consumer` — nothing reads the value. The open question is whether the
 *     field should exist, which is a decision rather than a missing test.
 *
 * What fails the gate:
 *
 *   - a field missing from the map, or a value of a union field, or one of the
 *     three states of an optional string field, or a colour key, or a feature
 *     key → `pnpm typecheck`, through the `satisfies` below;
 *   - an entry naming a spec or a title that does not exist → `pnpm test`,
 *     through the reference check in `map.test.ts`;
 *   - a `no-test` or `no-consumer` entry with no reason → `pnpm typecheck`,
 *     because `note` is required on both of those variants.
 *
 * What does not fail the gate: how many entries lack a test. `map.test.ts`
 * prints them on every run and passes. A threshold would be red the day this
 * landed, and a threshold pinned to today's count is a ratchet nobody chose
 * the value of. When the list can be zero, the print becomes
 * `expect(noTest).toHaveLength(0)` — one line, on the last of the tickets that
 * work from this map.
 *
 * Three limits worth knowing before reading the entries:
 *
 *   - every level of nesting is enumerated from that level's own `keyof`, so a
 *     sub-key added to `branding` or `seo` fails the gate exactly as a new
 *     top-level field does. What a brand new nested *object* gets is one entry
 *     for the object itself, until its shape is declared in `types.ts` — a
 *     mapped type over its `keyof`, about five lines. Do that and its keys are
 *     caught like everyone else's, at any depth; this is a declaration that has
 *     to be written, not a ceiling in the mechanism.
 *   - `features` and `theme.colors` are `Record<string, …>` in
 *     `PublicTenantConfig`, so no `satisfies` over that type could make their
 *     values total. Both are enumerated from types that already exist —
 *     `ThemeColorsSchema` for the colours, the seeded defaults object for the
 *     features — rather than from a list declared here, which would be a
 *     second copy free to drift.
 *   - the admin's schema carries two colour keys, `buttonText` and
 *     `buttonPurchaseText`, that `ThemeColorsSchema` does not name. `z.object()`
 *     strips unknown keys, so they never reach `tenant-css.ts` and they are
 *     correctly absent from the 40 below. The forty keys here are what the app
 *     can receive, not what a merchant can set.
 */

import type { ConfigCoverageMap } from './types';

const USE_TENANT = 'tests/composables/useTenant.test.ts';
const SERVER_TENANT = 'tests/server/tenant.test.ts';
const TENANT_CSS = 'tests/unit/server/utils/tenant-css.test.ts';
const THEME = 'tests/unit/server/utils/theme.test.ts';
const POWERED_BY = 'tests/components/PoweredBy.test.ts';
const BRAND_LOGO = 'tests/components/Logo.test.ts';
const FOOTER_MAIN = 'tests/components/layout/LayoutFooterMain.test.ts';
const FONTS = 'tests/shared/fonts.test.ts';
const FEATURE_ACCESS_CLIENT = 'tests/composables/useFeatureAccess.test.ts';
const FEATURE_ACCESS_SERVER = 'tests/server/feature-access.test.ts';
const TENANT_SEO = 'tests/plugins/tenant-seo.test.ts';
const LOCALE_MARKET = 'tests/server/middleware/locale-market.test.ts';
const LOCALE_SWITCHER = 'tests/components/LocaleSwitcher.test.ts';
const MARKET_SWITCHER = 'tests/components/MarketSwitcher.test.ts';
const GEINS_IMAGE = 'tests/components/GeinsImage.test.ts';

/**
 * The reader chain is the same for every feature: `hasFeature` gates the
 * on/off, `canAccess` adds the access dimension, and the middleware turns a
 * denial into a redirect. Those three mechanisms are asserted once each; what
 * varies per feature is whether anything in the app actually asks.
 */
const FEATURE_ENABLED_TRUE = {
  status: 'has-test',
  test: { spec: USE_TENANT, title: 'should return true for enabled feature' },
} as const;

const FEATURE_ENABLED_FALSE = {
  status: 'has-test',
  test: { spec: USE_TENANT, title: 'should return false for disabled feature' },
} as const;

const FEATURE_ACCESS_ALL = {
  status: 'has-test',
  test: {
    spec: FEATURE_ACCESS_CLIENT,
    title: 'grants access to enabled feature with no access rule',
  },
  note: "`access: 'all'` and an absent access rule take the same branch.",
} as const;

const FEATURE_ACCESS_AUTHENTICATED = {
  status: 'has-test',
  test: {
    spec: FEATURE_ACCESS_CLIENT,
    title: 'denies access to authenticated feature when anonymous',
  },
} as const;

const FEATURE_ACCESS_ABSENT = {
  status: 'has-test',
  test: {
    spec: FEATURE_ACCESS_SERVER,
    title: 'grants access to enabled feature with no access rule',
  },
  note: 'An absent access rule means open to everyone, not closed.',
} as const;

/** A feature the app reads: the shared reader assertions cover it. */
const CONSUMED_FEATURE = {
  enabled: { true: FEATURE_ENABLED_TRUE, false: FEATURE_ENABLED_FALSE },
  access: {
    all: FEATURE_ACCESS_ALL,
    authenticated: FEATURE_ACCESS_AUTHENTICATED,
    absent: FEATURE_ACCESS_ABSENT,
  },
} as const;

/**
 * A feature seeded for every tenant and read by nothing. Toggling it in the
 * admin changes nothing on the site, which is worse than an unused field: it
 * is a control that appears to work. Whether these should be removed or wired
 * up is a decision, not a missing test.
 */
function unconsumedFeature(note: string) {
  const entry = { status: 'no-consumer', note } as const;
  return {
    enabled: { true: entry, false: entry },
    access: { all: entry, authenticated: entry, absent: entry },
  };
}

/**
 * A colour the theme pipeline carries but no test follows to its CSS variable.
 * `deriveThemeColors` is asserted to return all 40 keys, and the resilient
 * parser is asserted to survive garbage in any of them, but neither says a
 * configured value reaches the emitted stylesheet.
 */
function unassertedColor(note: string) {
  return {
    status: 'no-test',
    consumer: 'server/utils/tenant-css.ts:generateTenantCss',
    note,
  } as const;
}

const COLOR_PRESENCE_ONLY = unassertedColor(
  "Presence is asserted collectively ('returns 40 keys total (32 standard + 8 " +
    "surfaces)' in tests/unit/server/utils/theme.test.ts); no test asserts a " +
    'set value reaches the emitted CSS variable.',
);

/** A surface colour: forwarded end-to-end and emitted verbatim, both asserted. */
const SURFACE_COLOR = {
  status: 'has-test',
  test: {
    spec: TENANT_CSS,
    title: 'emits all six surface vars verbatim when every surface is set',
  },
  note: "The unset case is asserted by 'emits the documented fallback chain when no surface is set'.",
} as const;

export const CONFIG_COVERAGE_MAP = {
  // --- Identity -----------------------------------------------------------
  tenantId: {
    status: 'has-test',
    test: { spec: USE_TENANT, title: 'should return tenantId from config' },
  },

  hostname: {
    status: 'has-test',
    test: { spec: USE_TENANT, title: 'should return hostname from config' },
  },

  aliases: {
    status: 'has-test',
    test: { spec: SERVER_TENANT, title: 'collectAllHostnames' },
    note: 'Every alias resolves to the same tenant; the mapping is written by writeHostnameMappings.',
  },

  // --- Portal and checkout mode -------------------------------------------
  mode: {
    commerce: {
      status: 'has-test',
      test: {
        spec: USE_TENANT,
        title: 'should be false when mode is commerce',
      },
    },
    catalog: {
      status: 'has-test',
      test: { spec: USE_TENANT, title: 'should be true when mode is catalog' },
    },
  },

  checkoutMode: {
    custom: {
      status: 'has-test',
      test: {
        spec: USE_TENANT,
        title: 'should return custom checkoutMode when set to custom',
      },
    },
    hosted: {
      status: 'has-test',
      test: {
        spec: USE_TENANT,
        title: 'should return checkoutMode from config',
      },
    },
  },

  // --- Theme ---------------------------------------------------------------
  theme: {
    name: {
      status: 'has-test',
      test: {
        spec: SERVER_TENANT,
        title: 'should create theme with correct name',
      },
      note: 'Synthesized from the tenant id when the API omits it.',
    },

    displayName: {
      status: 'no-consumer',
      note:
        'Nothing in app/ or server/ renders it. It is produced by ' +
        'createDefaultTheme (server/utils/tenant-css.ts:289) and survives a ' +
        'merge, so deleting the field would turn three assertions red — hence ' +
        'the transport reference below. The open question is whether the field ' +
        'should exist, not which test is missing.',
      test: {
        spec: SERVER_TENANT,
        title: 'should merge top-level theme properties',
      },
    },

    colors: {
      // The six the merchant must set.
      primary: {
        status: 'has-test',
        test: {
          spec: USE_TENANT,
          title: 'should return primaryColor from theme',
        },
      },
      primaryForeground: COLOR_PRESENCE_ONLY,
      secondary: {
        status: 'has-test',
        test: {
          spec: USE_TENANT,
          title: 'should return secondaryColor with default fallback',
        },
        note: 'Only the fallback is asserted; no test sets a value and reads it back.',
      },
      secondaryForeground: COLOR_PRESENCE_ONLY,
      background: {
        status: 'has-test',
        test: {
          spec: USE_TENANT,
          title: 'should return backgroundColor with default fallback',
        },
        note: 'Only the fallback is asserted; no test sets a value and reads it back.',
      },
      foreground: {
        status: 'has-test',
        test: {
          spec: USE_TENANT,
          title: 'should return foregroundColor with default fallback',
        },
        note: 'Only the fallback is asserted; no test sets a value and reads it back.',
      },

      // The 26 the server derives when the merchant leaves them null.
      card: COLOR_PRESENCE_ONLY,
      cardForeground: COLOR_PRESENCE_ONLY,
      popover: COLOR_PRESENCE_ONLY,
      popoverForeground: COLOR_PRESENCE_ONLY,
      muted: COLOR_PRESENCE_ONLY,
      mutedForeground: COLOR_PRESENCE_ONLY,
      accent: COLOR_PRESENCE_ONLY,
      accentForeground: COLOR_PRESENCE_ONLY,
      destructive: COLOR_PRESENCE_ONLY,
      destructiveForeground: COLOR_PRESENCE_ONLY,
      border: COLOR_PRESENCE_ONLY,
      input: COLOR_PRESENCE_ONLY,
      ring: COLOR_PRESENCE_ONLY,
      chart1: COLOR_PRESENCE_ONLY,
      chart2: COLOR_PRESENCE_ONLY,
      chart3: COLOR_PRESENCE_ONLY,
      chart4: COLOR_PRESENCE_ONLY,
      chart5: COLOR_PRESENCE_ONLY,
      sidebar: COLOR_PRESENCE_ONLY,
      sidebarForeground: COLOR_PRESENCE_ONLY,
      sidebarPrimary: COLOR_PRESENCE_ONLY,
      sidebarPrimaryForeground: COLOR_PRESENCE_ONLY,
      sidebarAccent: COLOR_PRESENCE_ONLY,
      sidebarAccentForeground: COLOR_PRESENCE_ONLY,
      sidebarBorder: COLOR_PRESENCE_ONLY,
      sidebarRing: COLOR_PRESENCE_ONLY,

      // The eight surfaces, six of which the emitter is asserted on.
      topBarBackground: SURFACE_COLOR,
      footerBackground: SURFACE_COLOR,
      navBarBackground: SURFACE_COLOR,
      siteBackground: SURFACE_COLOR,
      buttonBackground: {
        status: 'has-test',
        test: {
          spec: TENANT_CSS,
          title:
            'chains buttonPurchaseBackground through buttonBackground when only buttonBackground is set',
        },
      },
      buttonPurchaseBackground: SURFACE_COLOR,
      topBarText: unassertedColor(
        'Named in the schema round-trip and in the resilience key list, but no ' +
          'test asserts it emits a CSS variable. The six background surfaces ' +
          'around it are asserted; these two text surfaces were not carried along.',
      ),
      footerText: unassertedColor(
        'Named in the schema round-trip and in the resilience key list, but no ' +
          'test asserts it emits a CSS variable. The six background surfaces ' +
          'around it are asserted; these two text surfaces were not carried along.',
      ),
    },

    radius: {
      status: 'has-test',
      test: {
        spec: USE_TENANT,
        title: 'should return radius computed property (string)',
      },
    },

    typography: {
      presence: {
        present: {
          status: 'has-test',
          test: { spec: FONTS, title: 'builds URL for a single font family' },
          note: 'Drives the Google Fonts stylesheet link in app/error.vue and server/error.ts.',
        },
        absent: {
          status: 'has-test',
          test: { spec: FONTS, title: 'returns null for null typography' },
        },
      },
      families: {
        fontFamily: {
          status: 'has-test',
          test: { spec: FONTS, title: 'builds URL for a single font family' },
          note: 'The only required family; also emitted as a CSS variable by server/utils/tenant-css.ts:162.',
        },
        headingFontFamily: {
          status: 'has-test',
          test: { spec: FONTS, title: 'skips null heading and mono families' },
          note:
            'The fonts URL is asserted for both branches. The CSS side is not: ' +
            'server/utils/tenant-css.ts:169 falls back to fontFamily through `??`, ' +
            'and no test covers that.',
        },
        monoFontFamily: {
          status: 'has-test',
          test: { spec: FONTS, title: 'skips null heading and mono families' },
          note: 'Same as headingFontFamily: the fonts URL is asserted, the CSS variable is not.',
        },
      },
    },
  },

  // --- Branding ------------------------------------------------------------
  branding: {
    name: {
      status: 'has-test',
      test: {
        spec: USE_TENANT,
        title: 'should return brand name from branding',
      },
    },

    watermark: {
      full: {
        status: 'has-test',
        test: {
          spec: POWERED_BY,
          title: 'should render with variant="full" showing icon and label',
        },
        note: 'The config-to-variant step is asserted separately by the watermark describe in useTenant.test.ts.',
      },
      minimal: {
        status: 'has-test',
        test: {
          spec: POWERED_BY,
          title: 'should render with variant="minimal" showing icon only',
        },
      },
      none: {
        status: 'has-test',
        test: {
          spec: POWERED_BY,
          title: 'should not render with variant="none"',
        },
      },
    },

    logoUrl: {
      fallback: '??',
      states: {
        absent: {
          status: 'has-test',
          test: {
            spec: USE_TENANT,
            title: 'should return fallback /logo.svg when logoUrl is not set',
          },
        },
        empty: {
          status: 'no-test',
          consumer: 'app/composables/useTenant.ts:52',
          note:
            "`?? '/logo.svg'` does not fire on an empty string, so an empty " +
            'logoUrl yields `""` and renders a broken image rather than the ' +
            'placeholder. The live tenant sends this field as an empty string, ' +
            'so this is the state the app actually receives and the one state ' +
            'nothing asserts.',
        },
        set: {
          status: 'has-test',
          test: {
            spec: USE_TENANT,
            title: 'should return logoUrl from branding',
          },
        },
      },
    },

    logoDarkUrl: {
      fallback: 'none',
      states: {
        absent: {
          status: 'has-test',
          test: {
            spec: BRAND_LOGO,
            title: 'should render two images when srcDark is provided',
          },
          note: 'Reads back as null with no fallback; the component renders one image instead of two.',
        },
        empty: {
          status: 'no-test',
          consumer: 'app/components/shared/BrandLogo.vue',
          note: 'An empty string is truthy nowhere in this path but is not asserted either.',
        },
        set: {
          status: 'has-test',
          test: {
            spec: BRAND_LOGO,
            title: 'should render two images when srcDark is provided',
          },
        },
      },
    },

    logoSymbolUrl: {
      fallback: 'none',
      states: {
        absent: {
          status: 'no-test',
          consumer: 'app/composables/useTenant.ts:68',
          note: 'The set case is asserted; the absent case is not asserted separately.',
        },
        empty: {
          status: 'no-test',
          consumer: 'app/composables/useTenant.ts:68',
          note: 'Not asserted.',
        },
        set: {
          status: 'has-test',
          test: {
            spec: BRAND_LOGO,
            title:
              'should render symbol image with responsive classes when srcSymbol is provided',
          },
        },
      },
    },

    faviconUrl: {
      fallback: '??',
      states: {
        absent: {
          status: 'no-test',
          consumer: 'app/composables/useTenant.ts:72',
          note: "Falls back to '/favicon.ico'; no test asserts it.",
        },
        empty: {
          status: 'no-test',
          consumer: 'app/composables/useTenant.ts:72',
          note:
            'Same `??` problem as logoUrl: an empty string is returned verbatim ' +
            'rather than falling back. The live tenant sends this field empty.',
        },
        set: {
          status: 'no-test',
          consumer: 'app/composables/useTenant.ts:72',
          note: 'Not asserted.',
        },
      },
    },

    ogImageUrl: {
      fallback: 'none',
      states: {
        absent: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-seo.ts:79',
          note: 'The og:image meta tag is omitted; no test asserts either branch.',
        },
        empty: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-seo.ts:79',
          note: 'Not asserted.',
        },
        set: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-seo.ts:79',
          note: 'Not asserted.',
        },
      },
    },
  },

  // --- Layout --------------------------------------------------------------
  layout: {
    headerNavVariant: {
      grey: {
        status: 'no-test',
        consumer: 'app/components/layout/LayoutHeader.vue:11',
        note: 'The default when layout is absent, which is how the live tenant runs. No test file mentions the field.',
      },
      white: {
        status: 'no-test',
        consumer: 'app/components/layout/LayoutHeader.vue:11',
        note: 'No test file mentions the field.',
      },
      absent: {
        status: 'no-test',
        consumer: 'app/components/layout/LayoutHeader.vue:11',
        note: "Resolves to 'grey' through `??`. No test file mentions the field.",
      },
    },
  },

  // --- Features ------------------------------------------------------------
  features: {
    analytics: CONSUMED_FEATURE,
    applyForAccount: CONSUMED_FEATURE,
    cart: unconsumedFeature(
      'Seeded for every tenant and present in the live config, but no ' +
        'hasFeature, canAccess, isFeatureConfigured, constant or portal tab ' +
        "reads it. The 'should check cart feature correctly' case in " +
        'tests/middleware/feature.test.ts uses the name as an arbitrary string ' +
        'to exercise the middleware, alongside `search` and `authentication` ' +
        'which are not feature keys at all — mentioning is not asserting. ' +
        'The cart page gates on orderPlacement instead.',
    ),
    checkout: unconsumedFeature(
      'Seeded and present in the live config, read by nothing. The checkout ' +
        'page gates on orderPlacement instead.',
    ),
    lists: CONSUMED_FEATURE,
    newsletterSignup: CONSUMED_FEATURE,
    orderHistory: CONSUMED_FEATURE,
    orderPlacement: CONSUMED_FEATURE,
    priceVisibility: CONSUMED_FEATURE,
    quotes: CONSUMED_FEATURE,
    registration: unconsumedFeature(
      'Seeded and present in the live config, read by nothing.',
    ),
    reorder: CONSUMED_FEATURE,
    stockStatus: CONSUMED_FEATURE,
    wishlist: CONSUMED_FEATURE,
  },

  // --- CMS registry --------------------------------------------------------
  cms: {
    slots: {
      portal_hero: {
        status: 'no-test',
        consumer: 'app/components/portal/PortalShell.vue:32',
        note:
          'The reader is asserted for an arbitrary key in useCmsSlot.test.ts; ' +
          'no test asserts that this slot renders where it is configured.',
      },
      frontpage_content: {
        status: 'no-test',
        consumer: 'app/pages/index.vue:10',
        note: 'Reader mechanism asserted key-agnostically; this key is not.',
      },
      product_list_top: {
        status: 'no-test',
        consumer: 'app/components/pages/ProductList.vue:362',
        note: 'Reader mechanism asserted key-agnostically; this key is not.',
      },
      product_list_bottom: {
        status: 'no-test',
        consumer: 'app/components/pages/ProductList.vue:363',
        note: 'Reader mechanism asserted key-agnostically; this key is not.',
      },
      product_detail: {
        status: 'no-test',
        consumer: 'app/components/pages/ProductDetails.vue:361',
        note: 'Reader mechanism asserted key-agnostically; this key is not.',
      },
    },

    menus: {
      header_main: {
        status: 'no-test',
        consumer: 'app/components/layout/header/LayoutHeaderNav.vue:28',
        note:
          'The reader is asserted for an arbitrary key in useCmsMenu.test.ts; ' +
          'no test asserts that this menu renders where it is configured.',
      },
      footer: {
        status: 'has-test',
        test: {
          spec: FOOTER_MAIN,
          title:
            'renders three separate columns when all three menus have visible items',
        },
      },
      footer_2: {
        status: 'has-test',
        test: {
          spec: FOOTER_MAIN,
          title:
            'renders three separate columns when all three menus have visible items',
        },
      },
      footer_3: {
        status: 'has-test',
        test: {
          spec: FOOTER_MAIN,
          title:
            'renders three separate columns when all three menus have visible items',
        },
      },
      mobile_drawer: {
        status: 'no-test',
        consumer: 'app/components/layout/MobileNavPanel.vue:30',
        note: 'Reader mechanism asserted key-agnostically; this key is not.',
      },
      sidebar_fallback: {
        status: 'no-test',
        consumer: 'app/pages/[...slug].vue:93',
        note: 'Reader mechanism asserted key-agnostically; this key is not.',
      },
    },
  },

  // --- SEO -----------------------------------------------------------------
  // Every leaf here has a consumer and the live tenant sends all of them but
  // `robots` as empty strings, so the `empty` column is the one that matters.
  seo: {
    defaultTitle: {
      fallback: '||',
      states: {
        absent: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-seo.ts:115',
          note: 'Falls back to the brand name; not asserted.',
        },
        empty: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-seo.ts:115',
          note: '`||` makes empty behave as absent, which is correct here but unasserted.',
        },
        set: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-seo.ts:115',
          note: 'Not asserted.',
        },
      },
    },
    titleTemplate: {
      fallback: '||',
      states: {
        absent: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-seo.ts:114',
          note: "Falls back to '%s - <brand>'; not asserted.",
        },
        empty: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-seo.ts:114',
          note: '`||` makes empty behave as absent, which is correct here but unasserted.',
        },
        set: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-seo.ts:114',
          note: 'Not asserted.',
        },
      },
    },
    defaultDescription: {
      fallback: 'none',
      states: {
        absent: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-seo.ts:55',
          note: 'The description meta tag is omitted; not asserted.',
        },
        empty: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-seo.ts:55',
          note: 'Truthiness guard treats empty as absent; not asserted.',
        },
        set: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-seo.ts:55',
          note: 'Also feeds the WebSite schema description; not asserted.',
        },
      },
    },
    defaultKeywords: {
      status: 'no-test',
      consumer: 'app/plugins/tenant-seo.ts:63',
      note: 'An array, not a string: the guard is on length, and no test covers either branch.',
    },
    robots: {
      fallback: 'none',
      states: {
        absent: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-seo.ts:59',
          note: 'The only seo leaf the live tenant does not send empty. Not asserted.',
        },
        empty: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-seo.ts:59',
          note: 'Not asserted.',
        },
        set: {
          status: 'no-test',
          consumer: 'server/plugins/03.seo-config.ts:41',
          note: 'Also drives `indexable` server-side through isIndexable; not asserted for a tenant value.',
        },
      },
    },
    googleAnalyticsId: {
      fallback: 'none',
      states: {
        absent: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-analytics.ts:30',
          note: 'app/plugins/tenant-analytics.ts has no test file at all.',
        },
        empty: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-analytics.ts:30',
          note: 'app/plugins/tenant-analytics.ts has no test file at all.',
        },
        set: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-analytics.ts:30',
          note: 'app/plugins/tenant-analytics.ts has no test file at all.',
        },
      },
    },
    googleTagManagerId: {
      fallback: 'none',
      states: {
        absent: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-analytics.ts:31',
          note: 'app/plugins/tenant-analytics.ts has no test file at all.',
        },
        empty: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-analytics.ts:31',
          note: 'app/plugins/tenant-analytics.ts has no test file at all.',
        },
        set: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-analytics.ts:31',
          note: 'app/plugins/tenant-analytics.ts has no test file at all.',
        },
      },
    },
    verification: {
      fallback: 'none',
      states: {
        absent: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-seo.ts:96',
          note: 'The google-site-verification meta tag is omitted; not asserted.',
        },
        empty: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-seo.ts:96',
          note: 'Trimmed before the guard, so empty behaves as absent; not asserted.',
        },
        set: {
          status: 'no-test',
          consumer: 'app/plugins/tenant-seo.ts:96',
          note: 'Not asserted.',
        },
      },
    },
  },

  // --- Contact -------------------------------------------------------------
  contact: {
    email: {
      fallback: '||',
      states: {
        absent: {
          status: 'has-test',
          test: {
            spec: FOOTER_MAIN,
            title:
              'does not render contact column when both email and phone are null',
          },
        },
        empty: {
          status: 'no-test',
          consumer: 'app/components/layout/footer/LayoutFooterMain.vue:45',
          note:
            'The gate is `!!(email || phone)`, so empty takes the same branch as ' +
            'absent by construction — low risk, but no test passes an empty string.',
        },
        set: {
          status: 'has-test',
          test: {
            spec: FOOTER_MAIN,
            title: 'renders contact column when only email present',
          },
        },
      },
    },
    phone: {
      fallback: '||',
      states: {
        absent: {
          status: 'has-test',
          test: {
            spec: FOOTER_MAIN,
            title:
              'does not render contact column when both email and phone are null',
          },
        },
        empty: {
          status: 'no-test',
          consumer: 'app/components/layout/footer/LayoutFooterMain.vue:45',
          note: 'Same truthiness gate as email; not asserted.',
        },
        set: {
          status: 'has-test',
          test: {
            spec: FOOTER_MAIN,
            title: 'renders contact column when only phone present',
          },
        },
      },
    },
    address: {
      street: {
        status: 'has-test',
        test: {
          spec: FOOTER_MAIN,
          title:
            'renders wrapper when address is present even if menus and contact are null',
        },
        note: 'The address block is asserted as a group, not leaf by leaf.',
      },
      city: {
        status: 'has-test',
        test: {
          spec: FOOTER_MAIN,
          title:
            'renders wrapper when address is present even if menus and contact are null',
        },
        note: 'The address block is asserted as a group, not leaf by leaf.',
      },
      postalCode: {
        status: 'has-test',
        test: {
          spec: FOOTER_MAIN,
          title:
            'renders wrapper when address is present even if menus and contact are null',
        },
        note: 'The address block is asserted as a group, not leaf by leaf.',
      },
      country: {
        status: 'has-test',
        test: {
          spec: FOOTER_MAIN,
          title:
            'renders wrapper when address is present even if menus and contact are null',
        },
        note: 'The address block is asserted as a group, not leaf by leaf.',
      },
    },
    social: {
      facebook: {
        status: 'no-test',
        consumer: 'app/plugins/tenant-seo.ts:159',
        note: 'Feeds the Organization schema sameAs list; no test asserts any social leaf.',
      },
      instagram: {
        status: 'no-test',
        consumer: 'app/plugins/tenant-seo.ts:159',
        note: 'Feeds the Organization schema sameAs list; no test asserts any social leaf.',
      },
      twitter: {
        status: 'no-test',
        consumer: 'app/plugins/tenant-seo.ts:159',
        note: 'Feeds the Organization schema sameAs list; no test asserts any social leaf.',
      },
      linkedin: {
        status: 'no-test',
        consumer: 'app/plugins/tenant-seo.ts:159',
        note: 'Feeds the Organization schema sameAs list; no test asserts any social leaf.',
      },
      youtube: {
        status: 'no-test',
        consumer: 'app/plugins/tenant-seo.ts:159',
        note: 'Feeds the Organization schema sameAs list; no test asserts any social leaf.',
      },
    },
  },

  // --- Computed and derived ------------------------------------------------
  css: {
    status: 'has-test',
    test: {
      spec: TENANT_CSS,
      title:
        'emits no oklch() in the color block so older Safari can parse every var',
    },
    note: 'The generator is asserted here. Injection into the served document is e2e territory, not a unit concern.',
  },

  isActive: {
    true: {
      status: 'has-test',
      test: {
        spec: THEME,
        title: 'returns 40 keys total (32 standard + 8 surfaces)',
      },
      note: 'The active path is every other test in the suite; this reference stands in for it.',
    },
    false: {
      status: 'has-test',
      test: {
        spec: TENANT_SEO,
        title: 'does not call useHead when tenant is inactive',
      },
      note:
        'One of the three bail-out consumers is asserted. ' +
        'app/plugins/tenant-analytics.ts:21 and server/utils/tenant.ts are not.',
    },
  },

  locale: {
    status: 'has-test',
    test: {
      spec: LOCALE_MARKET,
      title:
        'redirects the cookieless root to the tenant config default locale when present',
    },
  },

  market: {
    status: 'has-test',
    test: {
      spec: LOCALE_MARKET,
      title:
        'redirects the cookieless root to the tenant config default market when present',
    },
  },

  availableLocales: {
    status: 'has-test',
    test: {
      spec: LOCALE_SWITCHER,
      title: 'should be false when only one locale available',
    },
    note: 'The switcher hides at length ≤ 1; the multi-locale case is asserted alongside it.',
  },

  availableMarkets: {
    status: 'has-test',
    test: {
      spec: MARKET_SWITCHER,
      title: 'should be false when only one market available',
    },
    note: 'The switcher hides at length ≤ 1, which is how the live tenant runs.',
  },

  imageBaseUrl: {
    status: 'has-test',
    test: { spec: GEINS_IMAGE, title: 'renders NuxtImg with raw CDN URL' },
    note: 'Derived from geinsSettings.accountName rather than configured directly.',
  },

  // If this line is where your error points, a field or a sub-key was added to
  // `PublicTenantConfig` and has no entry above. Add one. If no test covers it
  // yet, that is what `no-test` with a reason is for — the map is allowed to
  // record a gap, but not to omit the value.
} satisfies ConfigCoverageMap;

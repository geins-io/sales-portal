/**
 * Coverage map over `PublicTenantConfig`.
 *
 * One entry per value a tenant can configure, saying whether a test asserts
 * that value at its consumer and — when none does — why not. It is data and
 * types only: it re-tests nothing, and where a test exists the entry points at
 * it with a reference that says what the test proves (`kind` in `types.ts`).
 *
 * Three statuses, and they claim only what is checkable:
 *
 *   - `has-test` — at least one `consumer` reference: a consumer of the value
 *     is asserted to do something different for it. Any consumer, not only
 *     the one a `no-test` entry would name — which consumer the map names is
 *     an editorial choice, and the status must not depend on it. The note
 *     names the consumers that remain unasserted. Whether the assertion
 *     inside is correct is not something this map knows.
 *   - `no-test` — a consumer exists, named as `file:line`, and nothing asserts
 *     the value at any consumer; the one named is therefore always unasserted.
 *     The references on the entry say what *is* asserted — the value arrives
 *     (`carrier`), a shared reader interprets it (`reader`) — so the status
 *     names what is missing and the references what exists.
 *   - `no-consumer` — nothing reads the value. The open question is whether the
 *     field should exist, which is a decision rather than a missing test.
 *
 * What fails the gate:
 *
 *   - a field missing from the map, or a value of a union field, or one of the
 *     three states of an optional string field, or a colour key, or a feature
 *     key → `pnpm typecheck`, through the `satisfies` below;
 *   - a reference without a `kind`, or a `consumer` reference without
 *     `drives` → `pnpm typecheck`, through `TestRef`;
 *   - an entry naming a spec that does not exist, or a title that no `it`,
 *     `test` or `describe` in it declares → `pnpm test`, through the reference
 *     check in `map.test.ts`. The match is anchored on the call and the title
 *     is compared verbatim, so a title that appears only in prose, one that is
 *     merely the prefix of a longer title, and a generated one (`it.each`, a
 *     template literal) all fail rather than pass by accident;
 *   - a reference whose title two declarations carry → `pnpm test`. The map
 *     would name one and be checked against the other;
 *   - a reference to a declaration that is commented out or declared with
 *     `.skip`, `.only` or `.todo`, and any reference into a spec that skips or
 *     focuses a declaration anywhere in it → `pnpm test`. A test that does not
 *     run is not coverage, and a `describe.skip` is invisible to a check
 *     anchored on the `it` inside it, so the whole spec is scanned as well;
 *   - a `consumer` reference naming a `describe` → `pnpm test`. A describe
 *     title pins no assertion, so it cannot carry the claim that a consumer
 *     acts on the value; `carrier` and `reader` references may use one;
 *   - a `has-test` entry with no `consumer` reference, or one whose consumer
 *     tests all stub the reader with no `reader` reference on the same cell to
 *     bind the decision to the value (a blanket stub, `drives: 'stub'`, never
 *     binds it); a `no-test` entry whose references would qualify it; one
 *     (spec, title) carrying two kinds; a consumer reference on a feature cell
 *     whose title does not name the key → `pnpm test`;
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
 * Four limits worth knowing before reading the entries:
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
 *   - retired access rules never reach the app:
 *     `server/utils/tenant.ts:normalizeFeatureAccess` rewrites a feature
 *     carrying `{group}`, `{role}`, `{permission}` or `{accountType}` to
 *     `{enabled: false}` before the config leaves the server, so those values
 *     have no cell here. The boundary is asserted in
 *     `tests/server/tenant.test.ts` under `buildTenantConfig retired access
 *     rules`, named in prose rather than referenced: a reference would be a
 *     coverage claim on a cell that does not exist. If `FeatureAccess` ever
 *     regains one of those members the cell appears, and the test is already
 *     there to point at.
 */

import type {
  ConfigCoverageMap,
  Coverage,
  FeatureCoverage,
  TestRef,
} from './types';

const USE_TENANT = 'tests/composables/useTenant.test.ts';
const SERVER_TENANT = 'tests/server/tenant.test.ts';
const TENANT_CSS = 'tests/unit/server/utils/tenant-css.test.ts';
const FOOTER_MAIN = 'tests/components/layout/LayoutFooterMain.test.ts';
const LAYOUT_FOOTER = 'tests/components/layout/LayoutFooter.test.ts';
const LAYOUT_HEADER = 'tests/components/layout/LayoutHeader.test.ts';
const FONTS = 'tests/shared/fonts.test.ts';
const FEATURE_ACCESS_CLIENT = 'tests/composables/useFeatureAccess.test.ts';
const FEATURE_ACCESS_SERVER = 'tests/server/feature-access.test.ts';
const TENANT_SEO = 'tests/plugins/tenant-seo.test.ts';
const SERVER_TENANT_RESOLUTION = 'tests/server/tenant-resolution-log.test.ts';
const SEO_CONFIG_PLUGIN = 'tests/server/plugins/03.seo-config.test.ts';
const TENANT_CSS_PLUGIN = 'tests/server/plugins/04.tenant-css.test.ts';
const TENANT_ANALYTICS = 'tests/plugins/tenant-analytics.test.ts';
const LOCALE_MARKET = 'tests/server/middleware/locale-market.test.ts';
const GEINS_IMAGE = 'tests/components/GeinsImage.test.ts';
const CART_DRAWER = 'tests/components/cart/CartDrawer.test.ts';
const PRODUCT_CARD = 'tests/components/commerce/ProductCard.test.ts';
const PRODUCT_DETAILS = 'tests/components/pages/ProductDetails.test.ts';
const ORDER_DETAIL = 'tests/components/pages/order-detail.test.ts';
const SAVED_LIST_DETAIL = 'tests/components/portal/saved-list-detail.test.ts';
const CART_ROUTE = 'tests/components/pages/cart.test.ts';
const CHECKOUT_PAGE = 'tests/components/pages/checkout.test.ts';
const HEADER_ACTIONS =
  'tests/components/layout/LayoutHeaderActionButtons.test.ts';
const SERVER_CHECKOUT = 'tests/unit/api/checkout.test.ts';
const SERVER_CART = 'tests/server/api/cart.test.ts';
const SERVER_REGISTER = 'tests/server/api/auth-register.test.ts';
const AUTH_CARD = 'tests/components/auth/AuthCard.test.ts';
const AUTH_SHEET = 'tests/components/auth/AuthSheet.test.ts';
const BRAND_LOGO_FALLBACK = 'tests/components/BrandLogoFallback.test.ts';
const POWERED_BY = 'tests/components/PoweredBy.test.ts';
const HEADER_TOPBAR = 'tests/components/layout/LayoutHeaderTopbar.test.ts';
const PORTAL_SHELL = 'tests/components/portal/PortalShell.test.ts';
const PRICE_DISPLAY = 'tests/components/commerce/PriceDisplay.test.ts';
const STOCK_BADGE = 'tests/components/commerce/StockBadge.test.ts';
const STOCK_BADGE_UNIT = 'tests/unit/StockBadge.test.ts';
const PRODUCT_CARD_OOS = 'tests/components/shared/ProductCard.oos.test.ts';
const PRODUCT_DETAILS_OOS = 'tests/components/pages/ProductDetails.oos.test.ts';
const PRICE_VISIBILITY = 'tests/composables/usePriceVisibility.test.ts';
const STOCK_VISIBILITY = 'tests/composables/useStockVisibility.test.ts';
const NEWSLETTER_VISIBILITY =
  'tests/composables/useNewsletterVisibility.test.ts';
const CMS_SLOT = 'tests/composables/useCmsSlot.test.ts';
const CMS_MENU = 'tests/composables/useCmsMenu.test.ts';
const ANALYTICS_CONSENT = 'tests/composables/useAnalyticsConsent.test.ts';
const COOKIE_BANNER = 'tests/components/shared/CookieBanner.test.ts';
const FORMAT_LOCALE = 'tests/composables/useFormatLocale.test.ts';
const LOCALE_ALTERNATES = 'tests/composables/useLocaleAlternates.test.ts';
const SEO_LINKS = 'tests/composables/useSeoLinks.test.ts';
const CLIENT_LOCALE_MARKET = 'tests/composables/useLocaleMarket.test.ts';
const SERVER_LOCALE = 'tests/server/locale.test.ts';
const LOCALE_MARKET_GLOBAL = 'tests/middleware/locale-market-global.test.ts';
const AUTH_MIDDLEWARE = 'tests/middleware/auth.test.ts';
const GUEST_MIDDLEWARE = 'tests/middleware/guest.test.ts';
const FEATURE_MIDDLEWARE = 'tests/middleware/feature.test.ts';
const STORE_SETTINGS_SCHEMA = 'tests/server/store-settings-schema.test.ts';
const API_CONTRACTS = 'tests/server/api-contracts.test.ts';

const FEATURE_ACCESS_SHARED = 'tests/shared/feature-access.test.ts';

/**
 * The reader chain is the same for every feature: `hasFeature` gates the
 * on/off, `canAccessFeature` adds the access dimension. Both are key-agnostic
 * lookups — `features.value?.[featureName]`, no per-key logic — which is the
 * only reason a reader test on a synthetic key may prove cell → decision for
 * every feature at once. The map cannot guard that property; whoever adds an
 * `if (name === 'quotes')` to a reader breaks every composition below.
 *
 * Each list holds the reader tests that exercise exactly that cell's branch of
 * `canAccessFeature`: `!enabled` returns first, an absent `access` returns
 * true, `'all'` returns true from `evaluateAccess`, `'authenticated'` follows
 * the user. `all` and `absent` are two branches, so they carry two references.
 */
const READERS_ENABLED_TRUE: TestRef[] = [
  {
    spec: USE_TENANT,
    title: 'should return true for enabled feature',
    kind: 'reader',
  },
];

const READERS_ENABLED_FALSE: TestRef[] = [
  {
    spec: USE_TENANT,
    title: 'should return false for disabled feature',
    kind: 'reader',
  },
  {
    spec: FEATURE_ACCESS_CLIENT,
    title: 'denies access to disabled feature',
    kind: 'reader',
  },
];

const READERS_ACCESS_ALL: TestRef[] = [
  {
    spec: FEATURE_ACCESS_SHARED,
    title: 'returns true when enabled with access: "all"',
    kind: 'reader',
  },
];

/** Both outcomes of the cell: denied when anonymous, granted when signed in. */
const READERS_ACCESS_AUTHENTICATED: TestRef[] = [
  {
    spec: FEATURE_ACCESS_CLIENT,
    title: 'denies access to authenticated feature when anonymous',
    kind: 'reader',
  },
  {
    spec: FEATURE_ACCESS_CLIENT,
    title: 'grants access to authenticated feature when logged in',
    kind: 'reader',
  },
];

const READERS_ACCESS_ABSENT: TestRef[] = [
  {
    spec: FEATURE_ACCESS_SHARED,
    title: 'returns true when enabled with no access rule (defaults to all)',
    kind: 'reader',
  },
  {
    spec: FEATURE_ACCESS_CLIENT,
    title: 'grants access to enabled feature with no access rule',
    kind: 'reader',
  },
  {
    spec: FEATURE_ACCESS_SERVER,
    title: 'grants access to enabled feature with no access rule',
    kind: 'reader',
  },
];

const ACCESS_ABSENT_NOTE =
  'An absent access rule means open to everyone, not closed.';

/**
 * Why the access dimension of a `hasFeature`-only key is unread. Shared by
 * every such key: the mechanism is the same one, and stating it twice would be
 * the second copy this file warns about.
 *
 * `registration` is not one of them. Its consumers read
 * `features.registration.enabled` off the object rather than through
 * `hasFeature`, so it carries its own note — a different fact, not a copy.
 */
const HAS_FEATURE_ONLY_NOTE =
  'Every consumer of this key asks hasFeature, which reads `.enabled` and ' +
  'never looks at `.access`; none calls canAccess for it, so an access rule ' +
  'on it changes nothing.';

/**
 * The `access` dimension of a feature that is read for its `enabled` flag
 * only. No consumer routes the key through `canAccess`, so the access rule is
 * carried and never consulted.
 *
 * That is a narrower gap than an unread feature and a different one from a
 * missing test: the on/off control works, the access control does not exist,
 * and there is nothing to assert because nothing reads the value. Writing a
 * test here would be the over-claim this map exists to remove.
 *
 * `note` says why the value is unread, and it has two sources. A key whose
 * consumers go through `hasFeature` takes `HAS_FEATURE_ONLY_NOTE`; a key read
 * some other way carries its own sentence, because the mechanism is what
 * differs and stating the wrong one would be worse than repeating the right
 * one. The read sites themselves stay in the key's own `note`, where they are
 * already listed.
 */
function accessNeverRead(note: string) {
  const entry = { status: 'no-consumer', note } as const;
  return { all: entry, authenticated: entry, absent: entry };
}

const REGISTRATION_ACCESS = accessNeverRead(
  'All three consumers read `.enabled` directly; none calls canAccess for ' +
    'this key, so an access rule on it changes nothing.',
);

/**
 * One cell of a feature. The reader references prove cell → decision; a
 * consumer reference proves decision → behaviour, and only the two together
 * say the app obeys the value, which is why a cell with readers alone is
 * `no-test` and keeps them under `test`.
 */
function featureCell(
  consumer: string,
  readers: TestRef[],
  consumers: TestRef[] | undefined,
  note?: string,
): Coverage {
  const all = [...readers, ...(consumers ?? [])];
  if (consumers?.some((ref) => ref.drives !== 'stub')) {
    return { status: 'has-test', test: all, ...(note ? { note } : {}) };
  }
  const [only] = all;
  return {
    status: 'no-test',
    consumer,
    note: [
      'The reader is asserted for this cell on a synthetic key; no test asserts this feature at its consumer.',
      note,
    ]
      .filter(Boolean)
      .join(' '),
    // A single reference is written as one, so the list-form guard in
    // map.test.ts keeps meaning "a list has more than one member".
    test: all.length === 1 && only ? only : all,
  };
}

/**
 * A feature the app reads. `consumer` is the call site that asks, as
 * `file:line`; the optional lists are the consumer tests that name this key.
 *
 * Where each list hangs follows `canAccessFeature`: `on` → enabled.true and
 * `off` → enabled.false for tests that drive `enabled`; `granted` → every cell
 * that yields a grant (access.all, access.absent, and the signed-in half of
 * access.authenticated); `denied` → every cell that yields a denial
 * (access.authenticated when anonymous, and enabled.false, which the reader
 * checks first). A `granted` or `denied` test qualifies only in predicate form
 * — `mockCanAccess.mockImplementation((name) => name === key)`. A blanket
 * `mockReturnValue(true)` answers for every key and binds nothing: such a test
 * is listed with `drives: 'stub'` so it is checked against disk like any other
 * reference, and it never lifts a cell to `has-test`.
 */
interface FeatureRefs {
  on?: TestRef[];
  off?: TestRef[];
  granted?: TestRef[];
  denied?: TestRef[];
}

/**
 * Consumer references hung directly on one cell, bypassing the
 * `on`/`off`/`granted`/`denied` fan-out above.
 *
 * The fan-out exists for the composition case. A consumer test that received a
 * mocked reader answer cannot say which cell produced that answer, so
 * `granted` has to spread to every cell that yields a grant — `access.all`,
 * `access.absent`, and the signed-in half of `access.authenticated`.
 *
 * A `drives: 'field'` test writes the configured values itself, so the fan-out
 * would over-claim: an `access: 'all'` case would be credited for an absent
 * rule it never wrote. Hence one list per cell.
 *
 * The rule for filling those lists is **hang a case on the cell it is about**,
 * which is narrower than "every cell it discriminates". An access fixture has
 * to write `enabled: true` before the access rule is reached at all, and
 * flipping `enabled` would indeed fail it — but it is not hung on
 * `enabled.true`, because `enabled.true` has a case of its own and a second
 * reference to the same fact buys nothing.
 *
 * The one case on two cells is `enabled: true` with no access rule, hung on
 * `enabled.true` and `access.absent`. That is the same editorial choice, not a
 * stronger claim: an absent access rule cannot be written without also writing
 * `enabled: true`, so there is no separate case to give `access.absent` and
 * the two would otherwise be identical fixtures under different titles.
 */
interface FeatureCells {
  enabledTrue?: TestRef[];
  enabledFalse?: TestRef[];
  accessAll?: TestRef[];
  accessAuthenticated?: TestRef[];
  accessAbsent?: TestRef[];
}

function namedFeature(
  refs: {
    consumer: string;
    /**
     * Reader tests specific to this key — a visibility composable that sits
     * between the config and the component. Same hanging rule as the consumer
     * lists; they join the shared readers on each cell.
     */
    readers?: FeatureRefs;
    /** Consumer tests that drive the field, hung on the cell each one sets. */
    cells?: FeatureCells;
    /**
     * Replaces the whole access dimension. `accessNeverRead()` is what goes
     * here: a key nothing routes through `canAccess` has no access cell worth
     * a test, and the fan-out below would otherwise report three cells as
     * missing a test that must not be written.
     */
    access?: FeatureCoverage['access'];
    note?: string;
  } & FeatureRefs,
): FeatureCoverage {
  const r = refs.readers ?? {};
  const c = refs.cells ?? {};
  const granted = refs.granted ?? [];
  const denied = refs.denied ?? [];
  const rGranted = r.granted ?? [];
  const rDenied = r.denied ?? [];
  return {
    enabled: {
      true: featureCell(
        refs.consumer,
        [...READERS_ENABLED_TRUE, ...(r.on ?? [])],
        [...(refs.on ?? []), ...(c.enabledTrue ?? [])],
        refs.note,
      ),
      false: featureCell(
        refs.consumer,
        [...READERS_ENABLED_FALSE, ...(r.off ?? []), ...rDenied],
        [...(refs.off ?? []), ...denied, ...(c.enabledFalse ?? [])],
        refs.note,
      ),
    },
    access: refs.access ?? {
      all: featureCell(
        refs.consumer,
        [...READERS_ACCESS_ALL, ...rGranted],
        [...granted, ...(c.accessAll ?? [])],
      ),
      authenticated: featureCell(
        refs.consumer,
        [...READERS_ACCESS_AUTHENTICATED, ...rGranted, ...rDenied],
        [...granted, ...denied, ...(c.accessAuthenticated ?? [])],
      ),
      absent: featureCell(
        refs.consumer,
        [...READERS_ACCESS_ABSENT, ...rGranted],
        [...granted, ...(c.accessAbsent ?? [])],
        ACCESS_ABSENT_NOTE,
      ),
    },
  };
}

/**
 * The feature middleware's references for one key.
 *
 * `tests/middleware/feature.test.ts` runs the real middleware over a config
 * fixture, through the real `useFeatureAccess` and the real
 * `canAccessFeature` — nothing between the config and the redirect is mocked.
 * So every case drives the field, and each is hung on the cell it is about
 * rather than on every cell it would discriminate — see `FeatureCells`. The
 * three access cases all write `enabled: true` to reach the access check and
 * are not credited for it; the open-rule case is on two cells because
 * `access.absent` cannot be written without `enabled: true`.
 *
 * The middleware is the consumer for these keys on `pages/cart.vue:2`,
 * `pages/checkout.vue:26`, `portal/lists.vue:15`,
 * `portal/saved-lists/[id].vue:18`, `portal/favorites.vue:10`,
 * `portal/quotations/{index,[id]}.vue` and `portal/orders/{index,[id]}.vue`.
 */
function middlewareCells(key: string): FeatureCells {
  const ref = (title: string): TestRef[] => [
    { spec: FEATURE_MIDDLEWARE, title, kind: 'consumer', drives: 'field' },
  ];
  const openRule = ref(`allows ${key} when it is enabled with no access rule`);
  return {
    enabledTrue: openRule,
    accessAbsent: openRule,
    enabledFalse: ref(`redirects when ${key} is disabled`),
    accessAll: ref(`allows ${key} when access is open to all`),
    accessAuthenticated: [
      ...ref(
        `redirects when ${key} requires authentication and the user is anonymous`,
      ),
      ...ref(
        `allows ${key} when it requires authentication and the user is signed in`,
      ),
    ],
  };
}

/**
 * The cells of a component spec that un-mocks `useFeatureAccess` and writes
 * the configured value into the tenant fixture, so the real visibility
 * composable and `canAccessFeature` run between the two. Every case therefore
 * drives the field, and each is hung on the cell it is about rather than on
 * every cell it would discriminate — see `FeatureCells`.
 *
 * `openRule` is on two cells because `access.absent` cannot be written without
 * `enabled: true`; the other access cases write `enabled: true` to reach the
 * access check and are not credited for it. `access.authenticated` takes both
 * halves, the anonymous denial and the signed-in grant.
 *
 * A key omitted here has no case of that shape in the spec. `disabled` and
 * `accessAll` are optional for that reason.
 */
function visibilityCells(
  spec: string,
  titles: {
    openRule: string;
    disabled?: string;
    accessAll?: string;
    anonymous: string;
    signedIn: string;
  },
): FeatureCells {
  const ref = (title: string): TestRef[] => [
    { spec, title, kind: 'consumer', drives: 'field' },
  ];
  const openRule = ref(titles.openRule);
  return {
    enabledTrue: openRule,
    accessAbsent: openRule,
    ...(titles.disabled ? { enabledFalse: ref(titles.disabled) } : {}),
    ...(titles.accessAll ? { accessAll: ref(titles.accessAll) } : {}),
    accessAuthenticated: [...ref(titles.anonymous), ...ref(titles.signedIn)],
  };
}

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
 * The group test that asserts a configured value for this colour reaches its
 * own CSS variable. One test per colour group the type names; the fixture
 * writes every key in the group and a separate assertion discriminates each
 * one, so flipping one sentinel fails exactly that key's assertion. The proof
 * was run once per group: seven flips, seven runs, one red each, the key named
 * in the failure message.
 */
const CORE_GROUP: TestRef = {
  spec: TENANT_CSS,
  title: 'emits each of the six core colours as its own converted variable',
  kind: 'consumer',
  drives: 'field',
};
const SEMANTIC_GROUP: TestRef = {
  spec: TENANT_CSS,
  title:
    'emits each of the ten semantic surface colours as its own converted variable',
  kind: 'consumer',
  drives: 'field',
};
const EDGES_GROUP: TestRef = {
  spec: TENANT_CSS,
  title: 'emits each of the three edge colours as its own converted variable',
  kind: 'consumer',
  drives: 'field',
};
const CHART_GROUP: TestRef = {
  spec: TENANT_CSS,
  title: 'emits each of the five chart colours as its own converted variable',
  kind: 'consumer',
  drives: 'field',
};
const SIDEBAR_GROUP: TestRef = {
  spec: TENANT_CSS,
  title:
    'emits each of the eight sidebar colours as its own converted variable',
  kind: 'consumer',
  drives: 'field',
};
const SURFACE_TEXT_GROUP: TestRef = {
  spec: TENANT_CSS,
  title: 'emits both surface text colours as their own converted variable',
  kind: 'consumer',
  drives: 'field',
};

const FAMILY_GROUP: TestRef = {
  spec: TENANT_CSS,
  title: 'emits each of the three typography families as its own variable',
  kind: 'consumer',
  drives: 'field',
};

const BUILD_MERGE: TestRef = {
  spec: SERVER_TENANT,
  title:
    'carries a configured colour, surface and font family through the merge into config.css',
  kind: 'consumer',
  drives: 'field',
};

/**
 * The absent side, one reference per derivation family (`theme.ts:129-188`).
 * The three computed families carry two references each: a single fixture
 * proves one branch and leaves the other unasserted — the background and
 * foreground families branch on `L > 0.5`, and the primary family on
 * `priC > 0.05`, where a greyscale core also flattens every chart colour to
 * grey.
 */
const FIXED_FALLBACK: TestRef = {
  spec: TENANT_CSS,
  title:
    'derives card, destructive and its foreground from fixed values that no core changes',
  kind: 'consumer',
  drives: 'field',
};
const COPY_FALLBACK: TestRef = {
  spec: TENANT_CSS,
  title: 'derives ten colours as a verbatim copy of the core colour each names',
  kind: 'consumer',
  drives: 'field',
};
const BG_FAMILY: TestRef[] = [
  {
    spec: TENANT_CSS,
    title:
      'derives the background family through the dark branch when background is dark',
    kind: 'consumer',
    drives: 'field',
  },
  {
    spec: TENANT_CSS,
    title:
      'derives the background family through the light branch when background is light',
    kind: 'consumer',
    drives: 'field',
  },
];
const FG_FAMILY: TestRef[] = [
  {
    spec: TENANT_CSS,
    title:
      'derives mutedForeground through the dark branch when foreground is dark',
    kind: 'consumer',
    drives: 'field',
  },
  {
    spec: TENANT_CSS,
    title:
      'derives mutedForeground through the light branch when foreground is light',
    kind: 'consumer',
    drives: 'field',
  },
];
const PRIMARY_FAMILY: TestRef[] = [
  {
    spec: TENANT_CSS,
    title: 'derives ring and every chart colour from a chromatic primary',
    kind: 'consumer',
    drives: 'field',
  },
  {
    spec: TENANT_CSS,
    title:
      'derives ring from the neutral fallback when primary carries no chroma',
    kind: 'consumer',
    drives: 'field',
  },
];
const SURFACE_TEXT_FALLBACK: TestRef = {
  spec: TENANT_CSS,
  title: 'emits the documented fallback chain when no surface is set',
  kind: 'consumer',
  drives: 'field',
};

/** A derived colour: its group test for the set value, its family for the unset one. */
function derivedColor(
  group: TestRef,
  family: TestRef | TestRef[],
  note?: string,
): Coverage {
  const fam = Array.isArray(family) ? family : [family];
  return {
    status: 'has-test',
    test: [group, ...fam],
    ...(note ? { note } : {}),
  };
}

/**
 * The schema requires the six core colours. The test omits five of them and
 * asserts rejection, which proves the requirement for each — and nothing about
 * any value — so it hangs on those five as `carrier`.
 */
const COLOR_REQUIRED: TestRef = {
  spec: API_CONTRACTS,
  title: 'should reject TenantConfig with invalid theme colors',
  kind: 'carrier',
};

/** A required colour: the group test for the value, the schema for the requirement. */
function requiredColor(): Coverage {
  return {
    status: 'has-test',
    test: [CORE_GROUP, COLOR_REQUIRED],
    note: 'The group test for the emitted value, the schema for the requirement.',
  };
}

/**
 * The five branding URL fields are parsed by `SafeUrlSchema`, which rejects an
 * empty string. Each is a depth-2 path, so the resilient parser strips the
 * failing leaf and re-parses instead of substituting the whole block: the field
 * arrives absent, never as `''`. The merchant API may well send an empty
 * string; the app never receives one.
 */
function unreachableEmptyUrl(consumer: string) {
  return {
    status: 'no-test',
    consumer,
    note:
      'Unreachable through the merchant API: SafeUrlSchema rejects an empty ' +
      'string and the resilient parser strips the leaf, so the field arrives ' +
      'absent and the `absent` row above is the one that matters. The strip ' +
      "mechanism is asserted for the theme colours in 'strips multiple bad " +
      "leaves and logs each one', not for this field.",
  } as const;
}

/**
 * The schema requires `branding.watermark`. Rejecting its absence holds for
 * every value, so the reference sits on all three cells and distinguishes none
 * of them.
 */
/**
 * Logo.test.ts drives `srcDark` and `srcSymbol` as props, but
 * LayoutHeaderMain.vue:30 mounts `<BrandLogo class="shrink-0" />` with none, so
 * `props.srcDark ?? logoDarkUrl.value` resolves through the config in the app
 * and through the prop in those tests. The references here are the
 * config-driven cases; the prop ones are the same over-claim the `drives` doc
 * names for PoweredBy and are not referenced.
 */
const PROP_VS_CONFIG_NOTE =
  'Driven through the tenant config, not through the prop: the app mounts ' +
  'BrandLogo with no src props at all.';

const WATERMARK_REQUIRED: TestRef = {
  spec: STORE_SETTINGS_SCHEMA,
  title: 'should reject missing branding.watermark',
  kind: 'carrier',
};
const WATERMARK_NOTE =
  'The schema reference proves the field is required, not this value. The ' +
  'consumer reference drives `branding.watermark` through useTenant and ' +
  'mounts <PoweredBy /> with no props, which is how LayoutFooterBottom.vue:10 ' +
  'mounts it; the prop-driven tests in the same spec exercise ' +
  '`props.variant ?? watermark.value` from the other side and are not ' +
  'referenced. The getter is asserted by the watermark describe in ' +
  'useTenant.test.ts.';

/**
 * One `contact.social` leaf. Each has its own set case naming the key, so a
 * component that switched to another leaf while its title stayed put would show
 * up; the absent case is one fixture with `social: null`, which is the absent
 * state of all five at once and is shared the same way
 * `contact.email`/`contact.phone` share their null case.
 *
 * `''` is not a state here: `SafeUrlSchema` rejects an empty string and the
 * resilient parser strips the leaf, so the field arrives absent. The map gives
 * these leaves a bare `Coverage` rather than the three string states for that
 * reason.
 */
/**
 * The plugin returns early on `!gaId && !gtmId`, so each absent/empty case sets
 * the sibling id and asserts it was registered. Without that the assertion
 * would pass because the plugin bailed out rather than because the id was
 * unset.
 */
const ANALYTICS_SIBLING_NOTE =
  'The fixture sets the sibling id so the plugin reaches the per-id branch ' +
  'rather than returning early on both being unset.';

const SOCIAL_ABSENT: TestRef = {
  spec: TENANT_SEO,
  title:
    'omits sameAs from the Organization schema when no social URL is configured',
  kind: 'consumer',
  drives: 'field',
};

function socialLeaf(setCaseTitle: string): Coverage {
  return {
    status: 'has-test',
    test: [
      {
        spec: TENANT_SEO,
        title: setCaseTitle,
        kind: 'consumer',
        drives: 'field',
      },
      SOCIAL_ABSENT,
    ],
    note: 'The set case for this leaf, and the shared absent case for the whole block.',
  };
}

/**
 * A surface colour: forwarded end-to-end and emitted as converted sRGB, both
 * asserted. The fixture writes OKLCH because that is the only shape the app
 * receives — `CoercedColorSchema` normalises every colour through
 * `coerceToOklch`, and `toSafariSafeColor` returns a non-oklch value untouched,
 * so a hex fixture would prove the chain on a value format production cannot
 * deliver.
 */
const SURFACE_COLOR = {
  status: 'has-test',
  test: {
    spec: TENANT_CSS,
    title:
      'emits all six surface vars as converted sRGB when every surface is set',
    kind: 'consumer',
    drives: 'field',
  },
  note: "The unset case is asserted by 'emits the documented fallback chain when no surface is set', which covers all eight surface fallbacks including the two text ones.",
} as const;

export const CONFIG_COVERAGE_MAP = {
  // --- Identity -----------------------------------------------------------
  tenantId: {
    status: 'has-test',
    test: [
      {
        spec: USE_TENANT,
        title: 'should return tenantId from config',
        kind: 'carrier',
      },
      {
        spec: ANALYTICS_CONSENT,
        title: 'uses different keys for different tenants',
        kind: 'consumer',
        drives: 'field',
      },
    ],
    note: 'The getter, and the one place the value scopes stored state.',
  },

  hostname: {
    status: 'has-test',
    test: [
      {
        spec: USE_TENANT,
        title: 'should return hostname from config',
        kind: 'carrier',
      },
      {
        spec: SEO_CONFIG_PLUGIN,
        title: 'pushes the requested locale as currentLocale',
        kind: 'consumer',
        drives: 'field',
      },
      {
        spec: SERVER_TENANT_RESOLUTION,
        title:
          'a resolved lookup writes the config under its tenantId and a mapping for every hostname',
        kind: 'consumer',
        drives: 'field',
      },
    ],
    note:
      'The canonical site URL (server/plugins/03.seo-config.ts:36) and the ' +
      'hostname → tenantId mapping are asserted. Still unasserted: the error ' +
      'page header in server/error.ts:110 and the request log.',
  },

  aliases: {
    status: 'has-test',
    test: [
      {
        spec: SERVER_TENANT,
        title: 'should include hostname and all aliases',
        kind: 'carrier',
      },
      {
        spec: SERVER_TENANT_RESOLUTION,
        title:
          'a resolved lookup writes the config under its tenantId and a mapping for every hostname',
        kind: 'consumer',
        drives: 'field',
      },
      {
        spec: SERVER_TENANT_RESOLUTION,
        title: 'after a resolve, an alias is a KV hit: no merchant API call',
        kind: 'consumer',
        drives: 'field',
      },
    ],
    note:
      'writeHostnameMappings (server/utils/tenant.ts:277) is asserted to route ' +
      'every alias to the tenant, and a lookup on an alias to resolve from KV.',
  },

  // --- Portal and checkout mode -------------------------------------------
  mode: {
    commerce: {
      status: 'has-test',
      test: [
        {
          spec: USE_TENANT,
          title: 'should be false when mode is commerce',
          kind: 'reader',
        },
        {
          spec: CART_DRAWER,
          title:
            'renders the drawer when mode is commerce and orderPlacement access is granted',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: PRODUCT_DETAILS,
          title:
            'renders the add-to-cart action in commerce mode with orderPlacement access',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: ORDER_DETAIL,
          title:
            'renders the reorder button in commerce mode with reorder access',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: SAVED_LIST_DETAIL,
          title:
            'renders the add-to-cart controls in commerce mode with orderPlacement access',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: CART_ROUTE,
          title: 'renders the cart and does not redirect when mode is commerce',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: CHECKOUT_PAGE,
          title: 'renders the checkout and does not redirect in commerce mode',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: PRODUCT_CARD,
          title: 'renders add-to-cart button',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: HEADER_ACTIONS,
          title: 'renders cart button when orderPlacement access is granted',
          kind: 'consumer',
          drives: 'reader',
        },
      ],
      note:
        'The getter, then every consumer that branches on it. ' +
        'Each consumer that also reads an access rule asserts that half separately.',
    },
    catalog: {
      status: 'has-test',
      test: [
        {
          spec: USE_TENANT,
          title: 'should be true when mode is catalog',
          kind: 'reader',
        },
        {
          spec: STORE_SETTINGS_SCHEMA,
          title: 'normalises mode "catalogue" (UK spelling) to "catalog"',
          kind: 'carrier',
        },
        {
          spec: CART_DRAWER,
          title: 'does not render the drawer when mode is catalog',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: PRODUCT_DETAILS,
          title: 'hides the add-to-cart action when mode is catalog',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: ORDER_DETAIL,
          title: 'hides the reorder button when mode is catalog',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: SAVED_LIST_DETAIL,
          title: 'hides the add-to-cart controls when mode is catalog',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: CART_ROUTE,
          title: 'redirects to the start page when mode is catalog',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: CHECKOUT_PAGE,
          title: 'redirects to the start page when mode is catalog',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: PRODUCT_CARD,
          title:
            'hides add-to-cart button in grid variant when catalog mode is active',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: PRODUCT_CARD,
          title:
            'hides add-to-cart button in list variant when catalog mode is active',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: HEADER_ACTIONS,
          title: 'does not render cart button when catalog mode is active',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: SERVER_CHECKOUT,
          title: 'POST /api/checkout/token returns 403 in catalog mode',
          kind: 'consumer',
          drives: 'field',
        },
        {
          spec: SERVER_CART,
          title: 'POST /api/cart returns 403 in catalog mode',
          kind: 'consumer',
          drives: 'field',
        },
      ],
      note:
        'Catalog mode is not UI-only: five endpoints reject it with 403, ' +
        'and every client consumer hides its purchase affordance.',
    },
  },

  checkoutMode: {
    custom: {
      status: 'has-test',
      test: [
        {
          spec: USE_TENANT,
          title: 'should return custom checkoutMode when set to custom',
          kind: 'carrier',
        },
        {
          spec: CHECKOUT_PAGE,
          title:
            'renders the in-app form and requests no token when checkoutMode is custom',
          kind: 'consumer',
          drives: 'field',
        },
      ],
    },
    hosted: {
      status: 'has-test',
      test: [
        {
          spec: USE_TENANT,
          title: 'should return checkoutMode from config',
          kind: 'carrier',
        },
        {
          spec: CHECKOUT_PAGE,
          title:
            'posts the cart id and redirects to the hosted checkout when checkoutMode is hosted',
          kind: 'consumer',
          drives: 'field',
        },
        {
          spec: CHECKOUT_PAGE,
          title: 'shows the redirect error when the token call fails',
          kind: 'consumer',
          drives: 'field',
        },
      ],
      note:
        'The hand-off is split: the client branch here, the token endpoint in ' +
        'tests/server/api/checkout/token-post.test.ts.',
    },
  },

  // --- Theme ---------------------------------------------------------------
  theme: {
    name: {
      status: 'has-test',
      test: [
        {
          spec: TENANT_CSS_PLUGIN,
          title: 'sets the data-theme attribute from the tenant theme name',
          kind: 'consumer',
          drives: 'field',
        },
        {
          spec: SERVER_TENANT,
          title: 'should create theme with correct name',
          kind: 'carrier',
        },
        {
          spec: SERVER_TENANT,
          title: 'should generate CSS with data-theme selector',
          kind: 'consumer',
          drives: 'field',
        },
      ],
      note:
        'Synthesized from the tenant id when the API omits it. The CSS ' +
        'emitter is asserted to scope the stylesheet under the name. Still ' +
        'unasserted: the consumers that lower-case it into a theme class — ' +
        'server/plugins/04.tenant-css.ts:23, app/error.vue:25, server/error.ts:128.',
    },

    displayName: {
      status: 'no-consumer',
      note:
        'Nothing in app/ or server/ renders it. It is produced by ' +
        'createDefaultTheme (server/utils/tenant-css.ts:289) and survives a ' +
        'merge, so deleting the field would turn three assertions red — hence ' +
        'the carrier reference below. The open question is whether the field ' +
        'should exist, not which test is missing.',
      test: {
        spec: SERVER_TENANT,
        title: 'should merge top-level theme properties',
        kind: 'carrier',
      },
    },

    colors: {
      // The six the merchant must set.
      primary: {
        status: 'has-test',
        test: [
          CORE_GROUP,
          BUILD_MERGE,
          {
            spec: USE_TENANT,
            title: 'should return primaryColor from theme',
            kind: 'carrier',
          },
          {
            spec: STORE_SETTINGS_SCHEMA,
            title: 'should coerce hex colors to oklch',
            kind: 'carrier',
          },
          COLOR_REQUIRED,
        ],
        note:
          'The core group test for the value, plus the getter and the schema ' +
          "coercion. 'emits no oklch() in the color block so older Safari can " +
          "parse every var' also pins --primary for a chromatic core, but it " +
          'is referenced on `css` as `carrier` and a kind belongs to the test, ' +
          'not to the entry, so it is not repeated here as a consumer.',
      },
      primaryForeground: requiredColor(),
      secondary: {
        status: 'has-test',
        test: [
          CORE_GROUP,
          {
            spec: USE_TENANT,
            title: 'should return secondaryColor with default fallback',
            kind: 'carrier',
          },
          COLOR_REQUIRED,
        ],
      },
      secondaryForeground: requiredColor(),
      background: {
        status: 'has-test',
        test: [
          CORE_GROUP,
          {
            spec: USE_TENANT,
            title: 'should return backgroundColor with default fallback',
            kind: 'carrier',
          },
        ],
      },
      foreground: {
        status: 'has-test',
        test: [
          CORE_GROUP,
          {
            spec: USE_TENANT,
            title: 'should return foregroundColor with default fallback',
            kind: 'carrier',
          },
          COLOR_REQUIRED,
        ],
      },

      // The 26 the server derives when the merchant leaves them null.
      card: derivedColor(SEMANTIC_GROUP, [FIXED_FALLBACK, BUILD_MERGE]),
      cardForeground: derivedColor(SEMANTIC_GROUP, COPY_FALLBACK),
      popover: derivedColor(SEMANTIC_GROUP, COPY_FALLBACK),
      popoverForeground: derivedColor(SEMANTIC_GROUP, COPY_FALLBACK),
      muted: derivedColor(SEMANTIC_GROUP, BG_FAMILY),
      mutedForeground: derivedColor(SEMANTIC_GROUP, FG_FAMILY),
      accent: derivedColor(SEMANTIC_GROUP, COPY_FALLBACK),
      accentForeground: derivedColor(SEMANTIC_GROUP, COPY_FALLBACK),
      destructive: derivedColor(SEMANTIC_GROUP, FIXED_FALLBACK),
      destructiveForeground: derivedColor(SEMANTIC_GROUP, FIXED_FALLBACK),
      border: derivedColor(EDGES_GROUP, BG_FAMILY),
      input: derivedColor(EDGES_GROUP, BG_FAMILY),
      ring: derivedColor(EDGES_GROUP, PRIMARY_FAMILY),
      chart1: derivedColor(CHART_GROUP, PRIMARY_FAMILY),
      chart2: derivedColor(CHART_GROUP, PRIMARY_FAMILY),
      chart3: derivedColor(CHART_GROUP, PRIMARY_FAMILY),
      chart4: derivedColor(CHART_GROUP, PRIMARY_FAMILY),
      chart5: derivedColor(CHART_GROUP, PRIMARY_FAMILY),
      sidebar: derivedColor(SIDEBAR_GROUP, BG_FAMILY),
      sidebarForeground: derivedColor(SIDEBAR_GROUP, COPY_FALLBACK),
      sidebarPrimary: derivedColor(SIDEBAR_GROUP, COPY_FALLBACK),
      sidebarPrimaryForeground: derivedColor(SIDEBAR_GROUP, COPY_FALLBACK),
      sidebarAccent: derivedColor(SIDEBAR_GROUP, COPY_FALLBACK),
      sidebarAccentForeground: derivedColor(SIDEBAR_GROUP, COPY_FALLBACK),
      sidebarBorder: derivedColor(SIDEBAR_GROUP, BG_FAMILY),
      sidebarRing: derivedColor(SIDEBAR_GROUP, PRIMARY_FAMILY),

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
          kind: 'consumer',
          drives: 'field',
        },
      },
      buttonPurchaseBackground: SURFACE_COLOR,
      topBarText: derivedColor(
        SURFACE_TEXT_GROUP,
        [SURFACE_TEXT_FALLBACK, BUILD_MERGE],
        'The unset case falls back to var(--primary-foreground), asserted with the other seven surfaces in the fallback-chain test.',
      ),
      footerText: derivedColor(
        SURFACE_TEXT_GROUP,
        SURFACE_TEXT_FALLBACK,
        'The unset case falls back to a hardcoded oklch(0.85 0 0) that converts to #cecece, asserted in the fallback-chain test. That is why this key must never take sentinel L 0.85.',
      ),
    },

    radius: {
      status: 'has-test',
      test: [
        {
          spec: USE_TENANT,
          title: 'should return radius computed property (string)',
          kind: 'carrier',
        },
        {
          spec: SERVER_TENANT,
          title: 'should generate only base radius variable',
          kind: 'consumer',
          drives: 'field',
        },
        {
          spec: SERVER_TENANT,
          title: 'should not include radius when null',
          kind: 'consumer',
          drives: 'field',
        },
      ],
      note: 'The getter, and the emitter for both the set and the null value.',
    },

    typography: {
      presence: {
        present: {
          status: 'has-test',
          test: [
            {
              spec: TENANT_CSS_PLUGIN,
              title:
                'injects the google fonts stylesheet and preconnects when typography is configured',
              kind: 'consumer',
              drives: 'field',
            },
            {
              spec: FONTS,
              title: 'builds URL for a single font family',
              kind: 'reader',
            },
          ],
          note:
            'The URL builder, and the plugin that puts its URL in a <link>. ' +
            'app/error.vue:31 and server/error.ts:133 read the same builder ' +
            'and are still unasserted.',
        },
        absent: {
          status: 'has-test',
          test: [
            {
              spec: TENANT_CSS_PLUGIN,
              title: 'injects no fonts link when the tenant has no typography',
              kind: 'consumer',
              drives: 'field',
            },
            {
              spec: FONTS,
              title: 'returns null for null typography',
              kind: 'reader',
            },
          ],
          note: 'The builder returns null, and the plugin emits no link of any kind.',
        },
      },
      families: {
        fontFamily: {
          status: 'has-test',
          test: [
            FAMILY_GROUP,
            BUILD_MERGE,
            {
              spec: FONTS,
              title: 'builds URL for a single font family',
              kind: 'reader',
            },
          ],
          note: 'The only required family. The emitted CSS variable and the fonts URL.',
        },
        headingFontFamily: {
          status: 'has-test',
          test: [
            FAMILY_GROUP,
            {
              spec: FONTS,
              title: 'skips null heading and mono families',
              kind: 'reader',
            },
          ],
          note:
            'Absent is not "no variable" here: the consumer falls back to ' +
            'fontFamily through `??` (tenant-css.ts:169), so the variable is ' +
            'still emitted carrying the body family. monoFontFamily absent ' +
            'emits nothing at all — two different absent shapes in one group.',
        },
        monoFontFamily: {
          status: 'has-test',
          test: [
            FAMILY_GROUP,
            {
              spec: FONTS,
              title: 'skips null heading and mono families',
              kind: 'reader',
            },
          ],
          note: 'Unlike headingFontFamily, absent emits no variable at all.',
        },
      },
    },
  },

  // --- Branding ------------------------------------------------------------
  branding: {
    name: {
      status: 'has-test',
      test: [
        {
          spec: USE_TENANT,
          title: 'should return brand name from branding',
          kind: 'carrier',
        },
        {
          spec: BRAND_LOGO_FALLBACK,
          title: 'renders the brand name without a heading element',
          kind: 'consumer',
          drives: 'field',
        },
      ],
      note: 'The getter and the one place the value is rendered as text.',
    },

    watermark: {
      full: {
        status: 'has-test',
        test: [
          {
            spec: POWERED_BY,
            title:
              'renders the icon and the label when branding.watermark is full',
            kind: 'consumer',
            drives: 'field',
          },
          WATERMARK_REQUIRED,
        ],
        note: WATERMARK_NOTE,
      },
      minimal: {
        status: 'has-test',
        test: [
          {
            spec: POWERED_BY,
            title:
              'renders the icon without the label when branding.watermark is minimal',
            kind: 'consumer',
            drives: 'field',
          },
          WATERMARK_REQUIRED,
        ],
        note: WATERMARK_NOTE,
      },
      none: {
        status: 'has-test',
        test: [
          {
            spec: POWERED_BY,
            title: 'renders nothing at all when branding.watermark is none',
            kind: 'consumer',
            drives: 'field',
          },
          WATERMARK_REQUIRED,
        ],
        note: WATERMARK_NOTE,
      },
    },

    logoUrl: {
      fallback: '??',
      states: {
        absent: {
          status: 'has-test',
          test: [
            {
              spec: USE_TENANT,
              title: 'should return fallback /logo.svg when logoUrl is not set',
              kind: 'carrier',
            },
            {
              spec: BRAND_LOGO_FALLBACK,
              title:
                'renders the avatar fallback with single uppercase initial when logoUrl is empty',
              kind: 'consumer',
              drives: 'field',
            },
          ],
          note:
            'The second title says empty but the case drives an absent value, ' +
            'so it belongs here rather than under empty.',
        },
        empty: unreachableEmptyUrl('app/composables/useTenant.ts:52'),
        set: {
          status: 'has-test',
          test: [
            {
              spec: USE_TENANT,
              title: 'should return logoUrl from branding',
              kind: 'carrier',
            },
            {
              spec: BRAND_LOGO_FALLBACK,
              title: 'renders the logo image when the tenant has a logoUrl',
              kind: 'consumer',
              drives: 'field',
            },
          ],
          note: 'The getter, and the component rendering the configured image.',
        },
      },
    },

    logoDarkUrl: {
      fallback: 'none',
      states: {
        absent: {
          status: 'has-test',
          test: {
            spec: BRAND_LOGO_FALLBACK,
            title: 'renders a single image when the tenant has no logoDarkUrl',
            kind: 'consumer',
            drives: 'field',
          },
          note: PROP_VS_CONFIG_NOTE,
        },
        empty: unreachableEmptyUrl('app/components/shared/BrandLogo.vue'),
        set: {
          status: 'has-test',
          test: {
            spec: BRAND_LOGO_FALLBACK,
            title:
              'renders a second image when the tenant configures logoDarkUrl',
            kind: 'consumer',
            drives: 'field',
          },
          note: PROP_VS_CONFIG_NOTE,
        },
      },
    },

    logoSymbolUrl: {
      fallback: 'none',
      states: {
        absent: {
          status: 'has-test',
          test: {
            spec: BRAND_LOGO_FALLBACK,
            title:
              'renders no symbol image when the tenant has no logoSymbolUrl',
            kind: 'consumer',
            drives: 'field',
          },
          note: PROP_VS_CONFIG_NOTE,
        },
        empty: unreachableEmptyUrl('app/composables/useTenant.ts:68'),
        set: {
          status: 'has-test',
          test: {
            spec: BRAND_LOGO_FALLBACK,
            title:
              'renders the symbol image when the tenant configures logoSymbolUrl',
            kind: 'consumer',
            drives: 'field',
          },
          note: PROP_VS_CONFIG_NOTE,
        },
      },
    },

    faviconUrl: {
      fallback: '??',
      states: {
        absent: {
          status: 'has-test',
          test: {
            spec: TENANT_CSS_PLUGIN,
            title: 'injects no favicon link when faviconUrl is absent',
            kind: 'consumer',
            drives: 'field',
          },
          note:
            "The getter's '/favicon.ico' fallback is a second consumer and is " +
            'still unasserted; the served document simply carries no icon link.',
        },
        empty: unreachableEmptyUrl('server/plugins/04.tenant-css.ts:47'),
        set: {
          status: 'has-test',
          test: {
            spec: TENANT_CSS_PLUGIN,
            title: 'injects a favicon link for the configured faviconUrl',
            kind: 'consumer',
            drives: 'field',
          },
          note:
            'The value is emitted through sanitizeUrl, which allows only ' +
            'https: and data:image/, asserted by the non-https case in the ' +
            'same spec.',
        },
      },
    },

    ogImageUrl: {
      fallback: 'none',
      states: {
        absent: {
          status: 'has-test',
          test: {
            spec: TENANT_SEO,
            title:
              'omits the og:image and twitter:image meta when ogImageUrl is absent',
            kind: 'consumer',
            drives: 'field',
          },
        },
        empty: unreachableEmptyUrl('app/plugins/tenant-seo.ts:79'),
        set: {
          status: 'has-test',
          test: {
            spec: TENANT_SEO,
            title:
              'renders the configured ogImageUrl as both og:image and twitter:image',
            kind: 'consumer',
            drives: 'field',
          },
          note: 'One value, two meta tags.',
        },
      },
    },
  },

  // --- Layout --------------------------------------------------------------
  layout: {
    headerNavVariant: {
      grey: {
        status: 'has-test',
        test: {
          spec: LAYOUT_HEADER,
          title:
            'adds no shadow and hands down grey when headerNavVariant is grey',
          kind: 'consumer',
          drives: 'field',
        },
        note: 'The default when layout is absent, which is how the live tenant runs.',
      },
      white: {
        status: 'has-test',
        test: {
          spec: LAYOUT_HEADER,
          title:
            'adds the separating shadow and hands down white when headerNavVariant is white',
          kind: 'consumer',
          drives: 'field',
        },
        note: 'The only value that changes the header itself rather than only the nav below it.',
      },
      absent: {
        status: 'has-test',
        test: {
          spec: LAYOUT_HEADER,
          title:
            'falls back to grey when the tenant configures no headerNavVariant',
          kind: 'consumer',
          drives: 'field',
        },
        note: "Resolves to 'grey' through `??`.",
      },
    },
  },

  // --- Features ------------------------------------------------------------
  features: {
    analytics: namedFeature({
      consumer: 'app/components/shared/CookieBanner.vue:7',
      on: [
        {
          spec: COOKIE_BANNER,
          title: 'shows the cookie banner when analytics is enabled',
          kind: 'consumer',
          drives: 'field',
        },
      ],
      off: [
        {
          spec: COOKIE_BANNER,
          title: 'hides the cookie banner when analytics is disabled',
          kind: 'consumer',
          drives: 'field',
        },
      ],
      access: accessNeverRead(HAS_FEATURE_ONLY_NOTE),
      note:
        'The banner reads the key through hasFeature over the tenant fixture, ' +
        'so both cases write the configured value. The second consumer, ' +
        'app/plugins/tenant-analytics.ts:28, has no test file: it sits behind ' +
        'five gates and needs @nuxt/scripts mocked, which is a different kind ' +
        'of work and buys no cell the banner does not already hold. ' +
        'Storefront settings exposes no control for this key, so the value ' +
        'reaches the app from the seeded defaults or a features override ' +
        'rather than from anything a merchant sets.',
    }),
    applyForAccount: namedFeature({
      consumer: 'app/components/auth/AuthSheet.vue:75',
      on: [
        {
          spec: AUTH_SHEET,
          title:
            'shows apply link when applyForAccount enabled and apply page resolved',
          kind: 'consumer',
          drives: 'field',
        },
        {
          spec: HEADER_TOPBAR,
          title:
            '(c) apply anchor href equals CMS-resolved value when applyForAccount enabled and not authenticated',
          kind: 'consumer',
          drives: 'reader',
        },
      ],
      off: [
        {
          spec: AUTH_SHEET,
          title: 'hides apply link when applyForAccount feature is disabled',
          kind: 'consumer',
          drives: 'field',
        },
      ],
      access: accessNeverRead(HAS_FEATURE_ONLY_NOTE),
      note:
        "AuthSheet's useTenant mock implements hasFeature over a features " +
        'record the same way the real composable does, so both of its cases ' +
        'write the configured value. That re-implementation is a copy of a ' +
        'one-line function and has to follow useTenant.ts:44: were an absent ' +
        'key to start counting as enabled there, this mock and the one in ' +
        'setup-components.ts would both drift without anything turning red. ' +
        'The topbar spec answers a predicate on ' +
        'the key from an immutable set, so it stays a reader reference and has ' +
        'no disabled case. The second call site is ' +
        'app/components/layout/header/LayoutHeaderTopbar.vue:57. Storefront ' +
        'settings exposes no control for this key, so the value reaches the ' +
        'app from the seeded defaults or a features override rather than from ' +
        'anything a merchant sets.',
    }),
    cart: unconsumedFeature(
      'Seeded for every tenant and present in the live config, but no ' +
        'hasFeature, canAccess, isFeatureConfigured, constant or portal tab ' +
        'reads it. The cart page gates on orderPlacement instead. The middleware ' +
        'spec used to drive this key as an arbitrary string, alongside `search` ' +
        'and `authentication` which are not feature keys at all; it now drives ' +
        'the five keys the pages declare, so nothing in the suite mentions ' +
        'this one either.',
    ),
    checkout: unconsumedFeature(
      'Seeded and present in the live config, read by nothing. The checkout ' +
        'page gates on orderPlacement instead.',
    ),
    lists: namedFeature({
      consumer: 'app/components/portal/PortalShell.vue:116',
      cells: middlewareCells('lists'),
      denied: [
        {
          spec: PORTAL_SHELL,
          title: 'hides the lists tab when the lists feature is denied',
          kind: 'consumer',
          drives: 'reader',
        },
      ],
    }),
    newsletterSignup: namedFeature({
      consumer: 'app/components/layout/LayoutFooter.vue:2',
      readers: {
        on: [
          {
            spec: NEWSLETTER_VISIBILITY,
            title:
              'shows the newsletter when the feature is enabled: true with no access rule',
            kind: 'reader',
          },
        ],
        off: [
          {
            spec: NEWSLETTER_VISIBILITY,
            title:
              'hides the newsletter when the feature is explicitly enabled: false',
            kind: 'reader',
          },
        ],
        denied: [
          {
            spec: NEWSLETTER_VISIBILITY,
            title:
              'shows the newsletter only when authenticated for enabled + access: authenticated',
            kind: 'reader',
          },
        ],
      },
      cells: visibilityCells(LAYOUT_FOOTER, {
        openRule:
          'shows the newsletter when newsletterSignup is enabled with no access rule',
        disabled: 'hides the newsletter when newsletterSignup is disabled',
        accessAll:
          'shows the newsletter when newsletterSignup access is open to all',
        anonymous:
          'hides the newsletter when newsletterSignup requires authentication and the user is anonymous',
        signedIn:
          'shows the newsletter when newsletterSignup requires authentication and the user is signed in',
      }),
      note:
        'The key is read through NEWSLETTER_FEATURE_KEY, not as a literal. ' +
        'useNewsletterVisibility.test.ts asserts the composable for all three ' +
        'configured states, and those stay reader references because the ' +
        'composable sits between the config and the footer. The footer spec ' +
        'un-mocks useFeatureAccess and writes the configured value into the ' +
        'tenant fixture, so the real composable runs and the gate on ' +
        'LayoutFooterTop is asserted per cell. Storefront settings offers no ' +
        'access choice for this key, but useNewsletterVisibility does call ' +
        'canAccess, so a rule arriving from the seeded defaults or a features ' +
        'override is obeyed — which is why these are cells and not no-consumer.',
    }),
    orderHistory: namedFeature({
      consumer: 'app/components/portal/PortalShell.vue:116',
      cells: middlewareCells('orderHistory'),
      denied: [
        {
          spec: PORTAL_SHELL,
          title: 'hides the orders tab when the orderHistory feature is denied',
          kind: 'consumer',
          drives: 'reader',
        },
      ],
    }),
    orderPlacement: namedFeature({
      consumer: 'app/components/cart/CartDrawer.vue:19',
      cells: middlewareCells('orderPlacement'),
      granted: [
        {
          spec: CART_DRAWER,
          title:
            'renders the drawer when mode is commerce and orderPlacement access is granted',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: HEADER_ACTIONS,
          title: 'renders cart button when orderPlacement access is granted',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: PRODUCT_DETAILS,
          title:
            'renders the add-to-cart action in commerce mode with orderPlacement access',
          kind: 'consumer',
          drives: 'stub',
        },
        {
          spec: SAVED_LIST_DETAIL,
          title:
            'renders the add-to-cart controls in commerce mode with orderPlacement access',
          kind: 'consumer',
          drives: 'stub',
        },
      ],
      denied: [
        {
          spec: CART_DRAWER,
          title:
            'does not render the drawer when orderPlacement access is denied',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: PRODUCT_DETAILS,
          title:
            'hides the add-to-cart action when orderPlacement access is denied',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: SAVED_LIST_DETAIL,
          title:
            'hides the add-to-cart controls when orderPlacement access is denied',
          kind: 'consumer',
          drives: 'reader',
        },
        {
          spec: HEADER_ACTIONS,
          title:
            'does not render cart button when orderPlacement access is denied',
          kind: 'consumer',
          drives: 'reader',
        },
      ],
      note:
        'Seven call sites ask: CartDrawer.vue:19, ProductCard.vue:59, ' +
        'ProductDetails.vue:175, saved-lists/[id].vue:53, ' +
        'LayoutHeaderActionButtons.vue:17, and the feature middleware on ' +
        'pages/cart.vue:2 and pages/checkout.vue:26. The granted tests in ' +
        'ProductDetails and saved-list-detail run under a blanket ' +
        '`mockReturnValue(true)`, so they are stubs here and consumer proof on ' +
        "mode only; ProductCard's 'renders add-to-cart button' does not name " +
        'the key and stays on mode.',
    }),
    priceVisibility: namedFeature({
      consumer: 'app/components/shared/PriceDisplay.vue:33',
      readers: {
        on: [
          {
            spec: PRICE_VISIBILITY,
            title:
              'returns showPrice=true when priceVisibility feature enabled and canAccess returns true',
            kind: 'reader',
          },
        ],
        off: [
          {
            spec: PRICE_VISIBILITY,
            title:
              'returns showPrice=false when priceVisibility feature is present but enabled: false',
            kind: 'reader',
          },
        ],
        denied: [
          {
            spec: PRICE_VISIBILITY,
            title:
              'returns showPrice=false when priceVisibility feature enabled but canAccess returns false',
            kind: 'reader',
          },
        ],
      },
      cells: visibilityCells(PRICE_DISPLAY, {
        openRule:
          'shows the price when priceVisibility is enabled with no access rule',
        disabled: 'renders nothing when priceVisibility is disabled',
        accessAll: 'shows the price when priceVisibility access is open to all',
        anonymous:
          'renders nothing when priceVisibility requires authentication and the user is anonymous',
        signedIn:
          'shows the price when priceVisibility requires authentication and the user is signed in',
      }),
      note:
        'usePriceVisibility.test.ts asserts the composable for every state; it ' +
        'sits between the config and PriceDisplay, so those are reader ' +
        'references. The PriceDisplay tests un-mock useFeatureAccess and write ' +
        'the configured value into the tenant fixture, so the real ' +
        'usePriceVisibility and canAccessFeature run and each test drives the ' +
        'cell it is hung on. An absent key falls open, asserted by the ' +
        'fail-open cases in both specs.',
    }),
    quotes: namedFeature({
      consumer: 'app/components/portal/PortalShell.vue:116',
      cells: middlewareCells('quotes'),
      denied: [
        {
          spec: PORTAL_SHELL,
          title: 'hides the quotations tab when the quotes feature is denied',
          kind: 'consumer',
          drives: 'reader',
        },
      ],
    }),
    registration: {
      enabled: {
        true: {
          status: 'has-test',
          test: [
            {
              spec: AUTH_CARD,
              title:
                'shows divider, business-info, and apply button when registration enabled and apply resolved',
              kind: 'consumer',
              drives: 'field',
            },
            {
              spec: AUTH_CARD,
              title:
                'shows affordances (fail-open) when registration key is absent from features',
              kind: 'consumer',
              drives: 'field',
            },
            {
              spec: AUTH_CARD,
              title: 'shows affordances (fail-open) when features is undefined',
              kind: 'consumer',
              drives: 'field',
            },
            {
              spec: SERVER_REGISTER,
              title: 'returns user data when registration is enabled',
              kind: 'consumer',
              drives: 'field',
            },
            {
              spec: SERVER_REGISTER,
              title:
                'proceeds (fail-open) when registration key is missing from features',
              kind: 'consumer',
              drives: 'field',
            },
            {
              spec: SERVER_REGISTER,
              title: 'proceeds (fail-open) when tenant context is absent',
              kind: 'consumer',
              drives: 'field',
            },
          ],
          note:
            'Read as `features.registration.enabled ?? true` in three places: ' +
            'app/components/auth/AuthCard.vue:29, app/pages/login.vue:22 and ' +
            'server/api/auth/register.post.ts:20. An absent key and an absent ' +
            'features object both fall open to the same branch, which is why ' +
            'the fail-open cases sit here, on the client and on the endpoint.',
        },
        false: {
          status: 'has-test',
          test: [
            {
              spec: AUTH_CARD,
              title:
                'hides divider, business-info, and apply button when registration disabled',
              kind: 'consumer',
              drives: 'field',
            },
            {
              spec: AUTH_CARD,
              title:
                'forces login view when defaultView=register but registration disabled',
              kind: 'consumer',
              drives: 'field',
            },
            {
              spec: SERVER_REGISTER,
              title: 'throws 403 when registration is disabled',
              kind: 'consumer',
              drives: 'field',
            },
          ],
          note: 'The client hides the affordance and the endpoint refuses the call.',
        },
      },
      access: REGISTRATION_ACCESS,
    },
    reorder: namedFeature({
      consumer: 'app/pages/portal/orders/[id].vue:23',
      cells: visibilityCells(ORDER_DETAIL, {
        openRule:
          'renders the reorder button in commerce mode with reorder access',
        disabled: 'hides the reorder button when reorder is disabled',
        accessAll:
          'renders the reorder button when reorder access is open to all',
        anonymous:
          'hides the reorder button when reorder requires authentication and the user is anonymous',
        signedIn:
          'renders the reorder button when reorder requires authentication and the user is signed in',
      }),
      note:
        'The page gates on `canAccess(reorder) && !isCatalogMode`, so every ' +
        'case pins the half it is not about: the access cases leave catalog ' +
        'mode false, the catalog case leaves the rule permissive. The spec ' +
        'un-mocks useFeatureAccess and writes the configured value into the ' +
        'tenant fixture, so the real canAccessFeature runs. An absent key ' +
        'denies here, with no isFeatureConfigured guard, and that is the ' +
        'majority shape rather than an oddity: three consumers fall open (the ' +
        'price, stock and newsletter composables) and eight deny (the feature ' +
        'middleware, the PortalShell tabs, LayoutHeaderActionButtons, ' +
        'ProductCard, CartDrawer, ProductDetails, saved-lists/[id] and this ' +
        'page). What hides information falls open; what offers an action falls ' +
        "closed. Hence the spec's default fixture is the seeded " +
        '`{enabled: true}`.',
    }),
    stockStatus: namedFeature({
      consumer: 'app/components/shared/StockBadge.vue:15',
      readers: {
        on: [
          {
            spec: STOCK_VISIBILITY,
            title:
              'returns showStock=true when stockStatus feature enabled and canAccess returns true',
            kind: 'reader',
          },
        ],
        off: [
          {
            spec: STOCK_VISIBILITY,
            title:
              'returns showStock=false when stockStatus feature is present but enabled: false',
            kind: 'reader',
          },
        ],
        denied: [
          {
            spec: STOCK_VISIBILITY,
            title:
              'returns showStock=false when stockStatus feature enabled but canAccess returns false',
            kind: 'reader',
          },
        ],
      },
      cells: visibilityCells(STOCK_BADGE, {
        openRule:
          'shows the stock badge when stockStatus is enabled with no access rule',
        anonymous:
          'hides the stock badge when stockStatus requires authentication and the user is anonymous',
        signedIn:
          'shows the stock badge when stockStatus requires authentication and the user is signed in',
      }),
      off: [
        {
          spec: STOCK_BADGE,
          title:
            'hides stock when stockStatus is enabled:false with access defined',
          kind: 'consumer',
          drives: 'field',
        },
        {
          spec: PRODUCT_CARD_OOS,
          title: 'OOS UI fires regardless of the stockStatus tenant setting',
          kind: 'consumer',
          drives: 'stub',
        },
        {
          spec: PRODUCT_DETAILS_OOS,
          title: 'stock visibility off: OOS PDP still swaps to the OOS block',
          kind: 'consumer',
          drives: 'stub',
        },
      ],
      granted: [
        {
          spec: STOCK_BADGE_UNIT,
          title: 'shows badge when canAccess returns true for stockStatus',
          kind: 'consumer',
          drives: 'reader',
        },
      ],
      denied: [
        {
          spec: STOCK_BADGE_UNIT,
          title: 'hides badge when canAccess returns false',
          kind: 'consumer',
          drives: 'stub',
        },
      ],
      note:
        'useStockVisibility.test.ts asserts the composable for every state; it ' +
        'sits between the config and StockBadge, so those are reader ' +
        'references. The StockBadge tests un-mock useFeatureAccess and write ' +
        'the configured value into the tenant fixture, so the real ' +
        'useStockVisibility and canAccessFeature run and each test drives the ' +
        'cell it is hung on. The two OOS specs stub useStockVisibility itself ' +
        'and prove independence from its answer. access.all keeps its ' +
        'predicate-form reference from tests/unit/StockBadge.test.ts; a field ' +
        'case there would add a fixture without adding a cell.',
    }),
    wishlist: namedFeature({
      consumer: 'app/components/portal/PortalShell.vue:179',
      cells: middlewareCells('wishlist'),
      on: [
        {
          spec: PORTAL_SHELL,
          title: 'links to /portal/favorites when wishlist feature is enabled',
          kind: 'consumer',
          drives: 'field',
        },
      ],
      off: [
        {
          spec: PORTAL_SHELL,
          title: 'hides favorites quick link when wishlist feature is disabled',
          kind: 'consumer',
          drives: 'field',
        },
      ],
    }),
  },

  // --- CMS registry --------------------------------------------------------
  cms: {
    slots: {
      portal_hero: {
        status: 'has-test',
        test: [
          {
            spec: CMS_SLOT,
            title: 'returns the slot config when fully configured',
            kind: 'reader',
          },
          {
            spec: PORTAL_SHELL,
            title: 'shows CMS hero banner when CMS area has containers',
            kind: 'consumer',
            drives: 'field',
          },
        ],
        note:
          'useCmsSlot.test.ts drives this key throughout, not an arbitrary ' +
          'one, so the reader is asserted for it; PortalShell.test.ts asserts ' +
          'that the configured slot renders, and that an empty area renders ' +
          'nothing.',
      },
      frontpage_content: {
        status: 'no-test',
        consumer: 'app/pages/index.vue:10',
        note:
          "A tenant override of this key is asserted to survive the merge ('a " +
          "tenant slot override wins while sibling default slots are kept' in " +
          'tests/server/tenant.test.ts), so the value arrives; nothing asserts ' +
          'that the slot then renders.',
      },
      product_list_top: {
        status: 'no-test',
        consumer: 'app/components/pages/ProductList.vue:362',
        note: 'The reader is asserted for portal_hero; this key is named nowhere in the suite.',
      },
      product_list_bottom: {
        status: 'no-test',
        consumer: 'app/components/pages/ProductList.vue:363',
        note: 'The reader is asserted for portal_hero; this key is named nowhere in the suite.',
      },
      product_detail: {
        status: 'no-test',
        consumer: 'app/components/pages/ProductDetails.vue:361',
        note: 'The reader is asserted for portal_hero; this key is named nowhere in the suite.',
      },
    },

    menus: {
      header_main: {
        status: 'no-test',
        consumer: 'app/components/layout/header/LayoutHeaderNav.vue:28',
        test: {
          spec: CMS_MENU,
          title: 'returns the menu config when present',
          kind: 'reader',
        },
        note:
          'useCmsMenu.test.ts drives this key throughout, so the reader is ' +
          'asserted for it, including the partial-config case where an empty ' +
          'menuLocationId reads back as null. That the menu then renders in ' +
          'LayoutHeaderNav is not asserted.',
      },
      footer: {
        status: 'no-test',
        consumer: 'app/components/layout/footer/LayoutFooterMain.vue:15',
        note:
          'The footer renders what useCmsMenuData hands it, and the test stubs ' +
          'that composable; no reader test binds this key to the menu it ' +
          'returns, so the decision is asserted and the value is not.',
        test: {
          spec: FOOTER_MAIN,
          title:
            'renders three separate columns when all three menus have visible items',
          kind: 'consumer',
          drives: 'reader',
        },
      },
      footer_2: {
        status: 'no-test',
        consumer: 'app/components/layout/footer/LayoutFooterMain.vue:16',
        note:
          'The footer renders what useCmsMenuData hands it, and the test stubs ' +
          'that composable; no reader test binds this key to the menu it ' +
          'returns, so the decision is asserted and the value is not.',
        test: {
          spec: FOOTER_MAIN,
          title:
            'renders three separate columns when all three menus have visible items',
          kind: 'consumer',
          drives: 'reader',
        },
      },
      footer_3: {
        status: 'no-test',
        consumer: 'app/components/layout/footer/LayoutFooterMain.vue:17',
        note:
          'The footer renders what useCmsMenuData hands it, and the test stubs ' +
          'that composable; no reader test binds this key to the menu it ' +
          'returns, so the decision is asserted and the value is not.',
        test: {
          spec: FOOTER_MAIN,
          title:
            'renders three separate columns when all three menus have visible items',
          kind: 'consumer',
          drives: 'reader',
        },
      },
      mobile_drawer: {
        status: 'no-test',
        consumer: 'app/components/layout/MobileNavPanel.vue:30',
        note: 'The reader is asserted for header_main; this key is named nowhere in the suite.',
      },
      sidebar_fallback: {
        status: 'no-test',
        consumer: 'app/pages/[...slug].vue:93',
        note: 'The reader is asserted for header_main; this key is named nowhere in the suite.',
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
          status: 'has-test',
          test: {
            spec: TENANT_SEO,
            title:
              'falls back to the brand name as the title when defaultTitle is absent',
            kind: 'consumer',
            drives: 'field',
          },
        },
        empty: {
          status: 'has-test',
          test: {
            spec: TENANT_SEO,
            title:
              'treats an empty defaultTitle as absent and titles the page with the brand name',
            kind: 'consumer',
            drives: 'field',
          },
          note: '`||` makes empty behave as absent, and that is now the assertion.',
        },
        set: {
          status: 'has-test',
          test: {
            spec: TENANT_SEO,
            title: 'titles the page with the configured defaultTitle',
            kind: 'consumer',
            drives: 'field',
          },
        },
      },
    },
    titleTemplate: {
      fallback: '||',
      states: {
        absent: {
          status: 'has-test',
          test: {
            spec: TENANT_SEO,
            title:
              'wraps a page title with the brand pattern when titleTemplate is absent',
            kind: 'consumer',
            drives: 'field',
          },
          note: "Falls back to '%s - <brand>', asserted by wrapping a page title through the template.",
        },
        empty: {
          status: 'has-test',
          test: {
            spec: TENANT_SEO,
            title:
              'treats an empty titleTemplate as absent and wraps with the brand pattern',
            kind: 'consumer',
            drives: 'field',
          },
        },
        set: {
          status: 'has-test',
          test: {
            spec: TENANT_SEO,
            title: 'wraps a page title through the configured titleTemplate',
            kind: 'consumer',
            drives: 'field',
          },
        },
      },
    },
    defaultDescription: {
      fallback: 'none',
      states: {
        absent: {
          status: 'has-test',
          test: {
            spec: TENANT_SEO,
            title:
              'omits the description meta when defaultDescription is absent',
            kind: 'consumer',
            drives: 'field',
          },
        },
        empty: {
          status: 'has-test',
          test: {
            spec: TENANT_SEO,
            title:
              'omits the description meta when defaultDescription is empty',
            kind: 'consumer',
            drives: 'field',
          },
          note: 'Truthiness guard treats empty as absent, and both cases are asserted separately.',
        },
        set: {
          status: 'has-test',
          test: {
            spec: TENANT_SEO,
            title:
              'renders the configured defaultDescription as the description meta and the WebSite description',
            kind: 'consumer',
            drives: 'field',
          },
          note: 'One test, two consumers: the description meta and the WebSite schema description.',
        },
      },
    },
    defaultKeywords: {
      status: 'has-test',
      test: [
        {
          spec: TENANT_SEO,
          title:
            'renders configured defaultKeywords as a comma-separated keywords meta',
          kind: 'consumer',
          drives: 'field',
        },
        {
          spec: TENANT_SEO,
          title:
            'omits the keywords meta when defaultKeywords is an empty list',
          kind: 'consumer',
          drives: 'field',
        },
      ],
      note:
        'An array, not a string: the guard is on length, so the two branches ' +
        'are the set list and the empty list. `normalizeKeywords` turns both ' +
        "'' and ',' into [], so the empty list is the state that arrives.",
    },
    robots: {
      fallback: 'none',
      states: {
        absent: {
          status: 'has-test',
          test: {
            spec: TENANT_SEO,
            title: 'omits the robots meta when robots is absent',
            kind: 'consumer',
            drives: 'field',
          },
          note: 'The only seo leaf the live tenant does not send empty.',
        },
        empty: {
          status: 'has-test',
          test: {
            spec: TENANT_SEO,
            title: 'omits the robots meta when robots is empty',
            kind: 'consumer',
            drives: 'field',
          },
        },
        set: {
          status: 'has-test',
          test: [
            {
              spec: TENANT_SEO,
              title: 'renders the configured robots value as the robots meta',
              kind: 'consumer',
              drives: 'field',
            },
            {
              spec: SEO_CONFIG_PLUGIN,
              title:
                'pushes indexable false when the tenant robots value carries noindex',
              kind: 'consumer',
              drives: 'field',
            },
            {
              spec: SEO_CONFIG_PLUGIN,
              title:
                'pushes indexable true when the tenant robots value allows indexing',
              kind: 'consumer',
              drives: 'field',
            },
          ],
          note:
            'Both consumers: the client robots meta, and the server-side ' +
            '`indexable` flag through isIndexable. The 03 spec used to stub ' +
            'isIndexable to a constant, which is why neither branch was ' +
            'asserted before.',
        },
      },
    },
    googleAnalyticsId: {
      fallback: 'none',
      states: {
        absent: {
          status: 'has-test',
          test: {
            spec: TENANT_ANALYTICS,
            title:
              'omits the analytics script when googleAnalyticsId is absent',
            kind: 'consumer',
            drives: 'field',
          },
          note: ANALYTICS_SIBLING_NOTE,
        },
        empty: {
          status: 'has-test',
          test: {
            spec: TENANT_ANALYTICS,
            title: 'omits the analytics script when googleAnalyticsId is empty',
            kind: 'consumer',
            drives: 'field',
          },
          note: ANALYTICS_SIBLING_NOTE,
        },
        set: {
          status: 'has-test',
          test: {
            spec: TENANT_ANALYTICS,
            title:
              'registers the analytics script with the configured googleAnalyticsId',
            kind: 'consumer',
            drives: 'field',
          },
        },
      },
    },
    googleTagManagerId: {
      fallback: 'none',
      states: {
        absent: {
          status: 'has-test',
          test: {
            spec: TENANT_ANALYTICS,
            title:
              'omits the tag manager script when googleTagManagerId is absent',
            kind: 'consumer',
            drives: 'field',
          },
          note: ANALYTICS_SIBLING_NOTE,
        },
        empty: {
          status: 'has-test',
          test: {
            spec: TENANT_ANALYTICS,
            title:
              'omits the tag manager script when googleTagManagerId is empty',
            kind: 'consumer',
            drives: 'field',
          },
          note: ANALYTICS_SIBLING_NOTE,
        },
        set: {
          status: 'has-test',
          test: {
            spec: TENANT_ANALYTICS,
            title:
              'registers the tag manager script with the configured googleTagManagerId',
            kind: 'consumer',
            drives: 'field',
          },
        },
      },
    },
    verification: {
      fallback: 'none',
      states: {
        absent: {
          status: 'has-test',
          test: {
            spec: TENANT_SEO,
            title:
              'omits the google-site-verification meta when verification is absent',
            kind: 'consumer',
            drives: 'field',
          },
        },
        empty: {
          status: 'has-test',
          test: {
            spec: TENANT_SEO,
            title:
              'omits the google-site-verification meta when verification is empty or whitespace',
            kind: 'consumer',
            drives: 'field',
          },
          note: 'Trimmed before the guard, so the one test covers both empty and whitespace.',
        },
        set: {
          status: 'has-test',
          test: {
            spec: TENANT_SEO,
            title:
              'renders the configured verification token as the google-site-verification meta',
            kind: 'consumer',
            drives: 'field',
          },
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
            kind: 'consumer',
            drives: 'field',
          },
        },
        empty: {
          status: 'has-test',
          test: {
            spec: FOOTER_MAIN,
            title:
              'does not render the contact column when email is an empty string',
            kind: 'consumer',
            drives: 'field',
          },
          note: 'The gate is `!!(email || phone)`, so empty takes the same branch as absent.',
        },
        set: {
          status: 'has-test',
          test: {
            spec: FOOTER_MAIN,
            title: 'renders contact column when only email present',
            kind: 'consumer',
            drives: 'field',
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
            kind: 'consumer',
            drives: 'field',
          },
        },
        empty: {
          status: 'has-test',
          test: {
            spec: FOOTER_MAIN,
            title:
              'does not render the contact column when phone is an empty string',
            kind: 'consumer',
            drives: 'field',
          },
          note: 'Same truthiness gate as email.',
        },
        set: {
          status: 'has-test',
          test: {
            spec: FOOTER_MAIN,
            title: 'renders contact column when only phone present',
            kind: 'consumer',
            drives: 'field',
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
          kind: 'consumer',
          drives: 'field',
        },
        note: 'The address block is asserted as a group, not leaf by leaf.',
      },
      city: {
        status: 'has-test',
        test: {
          spec: FOOTER_MAIN,
          title:
            'renders wrapper when address is present even if menus and contact are null',
          kind: 'consumer',
          drives: 'field',
        },
        note: 'The address block is asserted as a group, not leaf by leaf.',
      },
      postalCode: {
        status: 'has-test',
        test: {
          spec: FOOTER_MAIN,
          title:
            'renders wrapper when address is present even if menus and contact are null',
          kind: 'consumer',
          drives: 'field',
        },
        note: 'The address block is asserted as a group, not leaf by leaf.',
      },
      country: {
        status: 'has-test',
        test: {
          spec: FOOTER_MAIN,
          title:
            'renders wrapper when address is present even if menus and contact are null',
          kind: 'consumer',
          drives: 'field',
        },
        note: 'The address block is asserted as a group, not leaf by leaf.',
      },
    },
    social: {
      facebook: socialLeaf(
        'includes the configured facebook URL in the Organization sameAs list',
      ),
      instagram: socialLeaf(
        'includes the configured instagram URL in the Organization sameAs list',
      ),
      twitter: socialLeaf(
        'includes the configured twitter URL in the Organization sameAs list',
      ),
      linkedin: socialLeaf(
        'includes the configured linkedin URL in the Organization sameAs list',
      ),
      youtube: socialLeaf(
        'includes the configured youtube URL in the Organization sameAs list',
      ),
    },
  },

  // --- Computed and derived ------------------------------------------------
  css: {
    status: 'has-test',
    test: [
      {
        spec: TENANT_CSS_PLUGIN,
        title:
          'injects the tenant css in a style tag tagged with the theme name',
        kind: 'consumer',
        drives: 'field',
      },
      {
        spec: TENANT_CSS_PLUGIN,
        title: 'strips a script tag out of the tenant css before injecting it',
        kind: 'consumer',
        drives: 'field',
      },
      {
        spec: TENANT_CSS,
        title:
          'emits no oklch() in the color block so older Safari can parse every var',
        kind: 'carrier',
      },
    ],
    note:
      'The generator that produces the value, and the plugin that sanitises ' +
      'and injects it into the served document. The sanitise assertion is a ' +
      'real one: the fixture carries a script payload that comes out as the ' +
      'bare rule. Only the browser-side effect of the injected tag is e2e.',
  },

  isActive: {
    true: {
      status: 'no-test',
      consumer: 'server/utils/tenant.ts:1050',
      note: 'The active path is every other test in the suite, and none of them asserts that an active config is the reason lookupTenant returns it.',
    },
    false: {
      status: 'has-test',
      test: [
        {
          spec: TENANT_SEO,
          title: 'does not call useHead when tenant is inactive',
          kind: 'consumer',
          drives: 'field',
        },
        {
          spec: SERVER_TENANT_RESOLUTION,
          title:
            'inactive tenant: unknown-tenant, negative-cached, nothing written to KV',
          kind: 'consumer',
          drives: 'field',
        },
        {
          spec: SERVER_TENANT_RESOLUTION,
          title: 'returns null for an inactive config and leaves it in KV',
          kind: 'consumer',
          drives: 'field',
        },
      ],
      note:
        'The server is where the value decides anything: lookupTenant returns ' +
        'null, so no config is emitted and the client never sees isActive false. ' +
        'The bail-outs in the two client plugins are defensive only.',
    },
  },

  locale: {
    status: 'has-test',
    test: [
      {
        spec: LOCALE_MARKET,
        title:
          'redirects the cookieless root to the tenant config default locale when present',
        kind: 'consumer',
        drives: 'field',
      },
      {
        spec: AUTH_MIDDLEWARE,
        title:
          'falls back to the tenant config default locale when the cookie is absent',
        kind: 'consumer',
        drives: 'field',
      },
      {
        spec: GUEST_MIDDLEWARE,
        title:
          'falls back to the tenant config default locale when the cookie is absent',
        kind: 'consumer',
        drives: 'field',
      },
      {
        spec: FEATURE_MIDDLEWARE,
        title: 'falls back to cookies, then config, then the se/sv pair',
        kind: 'consumer',
        drives: 'field',
      },
      {
        spec: SERVER_LOCALE,
        title:
          'should fall back to the tenant config default locale when cookie is not set',
        kind: 'reader',
      },
    ],
    note:
      'The server middleware decides the redirect; the three client ' +
      'middlewares build their own prefix and each asserts the config default ' +
      "and the 'sv' last resort separately.",
  },

  market: {
    status: 'has-test',
    test: [
      {
        spec: LOCALE_MARKET,
        title:
          'redirects the cookieless root to the tenant config default market when present',
        kind: 'consumer',
        drives: 'field',
      },
      {
        spec: CLIENT_LOCALE_MARKET,
        title: 'should fall back to the tenant default market when no cookie',
        kind: 'reader',
      },
      {
        spec: AUTH_MIDDLEWARE,
        title:
          'falls back to the tenant config default market when the cookie is absent',
        kind: 'consumer',
        drives: 'field',
      },
      {
        spec: GUEST_MIDDLEWARE,
        title:
          'falls back to the tenant config default market when the cookie is absent',
        kind: 'consumer',
        drives: 'field',
      },
      {
        spec: SEO_LINKS,
        title: 're-targets every hreflang value on a different market',
        kind: 'reader',
      },
    ],
    note:
      'The cookie wins over the config default, asserted alongside each ' +
      "fallback; 'se' is the last resort.",
  },

  availableLocales: {
    status: 'no-test',
    consumer: 'app/components/shared/LocaleSwitcher.vue:70',
    test: [
      {
        spec: CLIENT_LOCALE_MARKET,
        title: 'should not switch to a locale not in tenant available locales',
        kind: 'reader',
      },
      {
        spec: FORMAT_LOCALE,
        title: "expands the active locale to the tenant's own BCP-47 tag",
        kind: 'reader',
      },
      {
        spec: SEO_LINKS,
        title:
          'falls back to the tenant BCP-47 tag when the market is not an ISO region',
        kind: 'reader',
      },
      {
        spec: LOCALE_ALTERNATES,
        title: 'drops locales not in tenant available short codes',
        kind: 'reader',
      },
      {
        spec: SERVER_LOCALE,
        title: 'should expand short locale to BCP-47 using tenant config',
        kind: 'reader',
      },
    ],
    note:
      'Every reference is a reader: the allow-list for a locale switch, the ' +
      'source of the BCP-47 tag for formatting and hreflang, the filter on ' +
      'incoming alternates. LocaleSwitcher.test.ts is not referenced: it ' +
      "mirrors the switcher's computed inside the test file rather than " +
      'mounting it, so it proves nothing about the component.',
  },

  availableMarkets: {
    status: 'has-test',
    test: [
      {
        spec: CLIENT_LOCALE_MARKET,
        title: 'should not switch to a market not in tenant available markets',
        kind: 'reader',
      },
      {
        spec: LOCALE_MARKET_GLOBAL,
        title:
          'does not write the market cookie for a market the tenant does not sell',
        kind: 'consumer',
        drives: 'field',
      },
    ],
    note:
      'The global middleware is the consumer asserted; the list is also the ' +
      'allow-list for a market switch. MarketSwitcher.test.ts is not ' +
      "referenced: it mirrors the switcher's computed inside the test file " +
      'rather than mounting it, so it proves nothing about the component.',
  },

  imageBaseUrl: {
    status: 'has-test',
    test: {
      spec: GEINS_IMAGE,
      title: 'renders NuxtImg with raw CDN URL',
      kind: 'consumer',
      drives: 'field',
    },
    note: 'Derived from geinsSettings.accountName rather than configured directly.',
  },

  // If this line is where your error points, a field or a sub-key was added to
  // `PublicTenantConfig` and has no entry above. Add one. If no test covers it
  // yet, that is what `no-test` with a reason is for — the map is allowed to
  // record a gap, but not to omit the value.
} satisfies ConfigCoverageMap;

---
outline: deep
---

# Testing Guide

Testing strategy, architecture, and practices for the Sales Portal.

## Overview

3687 unit/component tests across 277 files + 12 E2E spec files / 226 tests across three browser projects (portal, auth, cart, navigation, search, routing, etc.).

Counts as of 2026-08-25. E2E has setup prerequisites — see [E2E Tests](#e2e-tests).

| Level       | Tool                    | What it tests                            |
| ----------- | ----------------------- | ---------------------------------------- |
| Unit        | Vitest                  | Functions, utilities, stores, middleware |
| Component   | Vitest + Vue Test Utils | Vue components in isolation              |
| Integration | Vitest                  | Server services hitting real Geins API   |
| E2E         | Playwright              | Complete user flows in a browser         |

## Test Stack

- **Vitest** with workspace projects (`vitest.workspace.ts`)
- **@nuxt/test-utils** — Nuxt test environment + config extraction
- **@vue/test-utils** — Vue component mounting
- **happy-dom** — Fast DOM implementation for component tests
- **Playwright** — E2E testing with Chromium

## Workspace Architecture

The test suite uses a **3-tier Vitest workspace** to minimize environment overhead. The full Nuxt test environment takes ~8s to boot per file, so we only use it where strictly necessary.

```
vitest.workspace.ts
├── node (37 files)        — Server, stores, composables, utils, shared
├── components (10 files)  — Vue component rendering with mocked useTenant
└── nuxt (7 files)         — Tests needing full Nuxt runtime
```

### Tier 1: Node (`environment: 'node'`)

The fastest tier. Uses `getVitestConfigFromNuxt()` to get Nuxt's Vite config (aliases, auto-import plugins, package resolution) **without** booting the Nuxt runtime. This means `#shared/...` aliases, `computed`, `ref`, and other auto-imports all work.

- **Setup:** `tests/setup.ts` — console suppression only
- **Flags:** `isolate: false`, `sequence.concurrent: true`
- **Files:** `tests/server/`, `tests/stores/`, `tests/middleware/`, `tests/composables/` (except those needing Nuxt), `tests/unit/`, `tests/utils/`

### Tier 2: Components (`environment: 'happy-dom'`)

Component tests that need a DOM but not the full Nuxt runtime. The `useTenant` composable (which calls `useFetch` + `useNuxtApp`) is mocked in the setup file so components render with test tenant data.

- **Setup:** `tests/setup-components.ts` — console suppression + Pinia init + `useTenant` mock
- **Flags:** `isolate: false`, `sequence.concurrent: true`
- **Files:** Most `tests/components/` files

### Tier 3: Nuxt (`environment: 'nuxt'`)

Tests that truly require the Nuxt runtime — those using `registerEndpoint`, `mockNuxtImport`, `useNuxtApp()`, `useRoute()`, or `useRouter()` from Nuxt internals.

- **Setup:** `tests/setup-nuxt.ts` — console suppression + `registerEndpoint('/api/config', ...)`
- **Flags:** `sequence.concurrent: true`
- **Files:** `useCmsPreview`, `useTenant`, `useErrorTracking`, `LayoutHeaderMain`, `MobileNavPanel`, `api-contracts`, `external-api`

### Deciding which tier for a new test

1. Does the test need a DOM (component mount/render)? **No** → `node` tier
2. Does the component call `useRoute()`, `useRouter()`, or other Nuxt runtime APIs directly? **Yes** → `nuxt` tier
3. Does the component only need `useTenant`? → `components` tier (already mocked)
4. Does the test use `registerEndpoint` or `mockNuxtImport`? → `nuxt` tier
5. Default → `node` tier

After creating a test, add its path to the appropriate list in `vitest.workspace.ts`. Files not in `nuxtTestFiles` or `componentTestFiles` are automatically picked up by the node tier.

### Performance tuning

| Setting                     | Where            | Why                                                         |
| --------------------------- | ---------------- | ----------------------------------------------------------- |
| `isolate: false`            | node, components | Reuses module cache across files — no per-file worker setup |
| `sequence.concurrent: true` | all tiers        | Runs tests within a file concurrently                       |
| `getVitestConfigFromNuxt()` | node, components | Shares Nuxt's Vite config without booting Nuxt              |
| `happy-dom` over `jsdom`    | components       | ~3s faster for 10 component files                           |

### Performance benchmarks

The full suite runs in ~70-80s:

- **3687 tests** across **277 files**
- Transform: ~55s, setup: ~90s, collect: ~240s, tests: ~120s
- Environment overhead: ~115s (shared across tiers)
- Nuxt boot: single instance shared via `getVitestConfigFromNuxt()`

Keeping `isolate: false` is critical — enabling isolation adds ~15s from per-file worker spawning.

### Mock discipline

Only mock at the **SDK boundary** (`@geins/*` packages) and external services (HTTP, email). Never mock internal modules, utilities, or services from this codebase.

Allowed mocks:

- `vi.mock('@geins/...')` — SDK packages
- `vi.stubGlobal('useRuntimeConfig', ...)` — Nitro globals in node tier
- `vi.stubGlobal('getPreviewCookie', ...)` — server CMS utilities
- `vi.mock('~/composables/useTenant')` — in component tier setup (bridges Nuxt runtime gap)

### Global stubs

The shared mount helper at `tests/utils/component.ts` provides global stubs that all component tests inherit:

- **`Icon`** — plain render with `data-name` attribute (matches `<Icon name="lucide:..." />`)
- **`NuxtIcon`** — same shape as Icon. `@nuxt/icon` registers its component as `NuxtIcon`, not `Icon`. Without this stub, `Icon`-keyed stubs are silent no-ops and icon assertions pass vacuously.
- **`NuxtLink`** — renders as `<a>` with `href` for route assertion
- **`NuxtImg`** — renders as `<img>` with `src` passthrough

### Shared test fixtures

`tests/fixtures/quote.ts` exports reusable factories:

- `makeQuote(overrides?)` — domain `Quote` object with all required fields
- `makeQuoteListItem(overrides?)` — list-row shape
- `makeRawQuotationCart(overrides?)` — raw GraphQL response shape for server service tests

Use `Partial<>` overrides to customize per-test. Import from `tests/fixtures/quote` instead of defining local factories in each test file.

Forbidden:

- Mocking internal services (`server/services/*`)
- Mocking shared utilities (`shared/types/*`, `shared/utils/*`)
- Mocking Pinia stores when testing components that use them

Only external boundaries may be mocked: the Geins SDK, network calls, and
framework auto-imports. See [AGENTS.md](https://github.com/geins-io/sales-portal/blob/main/AGENTS.md) for the project-wide rules.

### Test routing (glob-based)

Tests are routed to tiers by file path globs in `vitest.workspace.ts`:

| Glob pattern                     | Tier       | Environment         |
| -------------------------------- | ---------- | ------------------- |
| `tests/components/**` (default)  | components | happy-dom           |
| Explicit list in `nuxtTestFiles` | nuxt       | nuxt (full runtime) |
| Everything else                  | node       | node                |

To add a new test:

1. Create the file in the appropriate `tests/` subdirectory
2. If it needs the Nuxt runtime (`useRoute`, `registerEndpoint`), add its path to `nuxtTestFiles` in `vitest.workspace.ts`
3. If it's a component test, it's automatically picked up by the components tier
4. Otherwise, it falls through to the node tier

## Running Tests

### Unit and Component Tests

```bash
pnpm test              # Run all tests once
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage report
pnpm test:ui           # Vitest visual UI
```

### E2E Tests

E2E has three prerequisites. Miss any of them and tests fail in ways that look like
application bugs.

#### 1. Tenant hostname

Tests run against a tenant hostname, not `localhost`, so the multi-tenant server plugin can
resolve a tenant. Add to `/etc/hosts`:

```
127.0.0.1 tenant-a.litium.portal
```

A wildcard `*.litium.portal` resolver (dnsmasq — see `infra/local-development.md`) works too.

#### 2. A test account

`tenant-a` gates `orderPlacement` and `priceVisibility` behind `access: 'authenticated'`, so an
anonymous visitor gets **no prices and no add-to-cart button**. The cart and portal specs
therefore need a signed-in customer. Add to `.env` (gitignored):

```
E2E_USERNAME=<test customer email>
E2E_PASSWORD=<password>
```

Requirements for the account:

- A **B2B customer** on the tenant behind `tenant-a.litium.portal` — not an admin or API key.
- Use a **dedicated test user**, never a personal login. The suite signs in repeatedly and
  mutates cart state.
- One portal test additionally needs a **saved list containing products**; without it that test
  skips.

Without these variables the auth-dependent specs **skip rather than fail**
(`hasE2ECredentials()` in `tests/e2e/helpers.ts`), so the suite stays green — you simply get less
coverage. The run summary names what was skipped.

> Logging in inside each test is not viable: `loginRateLimiter` allows 5 logins per minute per IP
> (`server/utils/rate-limiter.ts`) and every test shares `127.0.0.1`. `tests/e2e/auth.setup.ts`
> authenticates **once** and persists the session to `playwright/.auth/user.json` (gitignored);
> specs opt in with `test.use({ storageState: STORAGE_STATE })`.

#### 3. `E2E=1` on the dev server

```bash
pnpm test:e2e          # simplest — Playwright starts the server itself with E2E=1
```

If you start the dev server yourself, it **must** carry the flag:

```bash
E2E=1 pnpm dev         # terminal 1
pnpm test:e2e          # terminal 2
```

`E2E=1` disables Nuxt DevTools and `@nuxt/hints` (see `nuxt.config.ts`). Both inject fixed
overlays that intercept pointer events at phone viewports, so `Mobile Chrome` tests fail without
it. Playwright sets it via `webServer.env`, but `reuseExistingServer` is true outside CI — it
attaches to whatever already holds port 3000 rather than restarting it. **A plain `pnpm dev` is
the most common cause of a local run disagreeing with a clean one.**

#### 4. TLS for the production build (`E2E_PROD=1` and CI)

The production build only works over https. Its CSP sets `upgrade-insecure-requests`, so over plain
http the browser rewrites every `/_nuxt/*` request to https, nothing answers, and no JavaScript loads
— the page renders server-side and never hydrates. Its auth cookies are `Secure`, so even a
successful login leaves no session. Both are correct in production and invisible on the dev server,
which has neither.

So the production-build path (`E2E_PROD=1 pnpm test:e2e` locally, always in CI) serves `pnpm preview`
over https with a self-signed certificate for `*.litium.portal`:

```bash
infra/scripts/local-cert.sh    # writes .certs/local.{crt,key}; pnpm local:setup runs it too
E2E_PROD=1 pnpm test:e2e       # build + preview over https://tenant-a.litium.portal:3000
```

`playwright.config.ts` reads the pair and hands it to `pnpm preview` as `NITRO_SSL_CERT` /
`NITRO_SSL_KEY` (Nitro's node-server preset serves TLS when both hold PEM contents), switches the base
URL to `https://` and sets `ignoreHTTPSErrors` so the bundled browsers accept the cert without it being
trusted. Nothing is installed in a trust store and nothing reaches the shipped build. To browse the
local production build yourself without a warning, `mkcert -install` is optional and separate.

#### Commands

```bash
pnpm test:e2e          # Headless, all projects (chromium, Mobile Chrome, webkit)
pnpm test:e2e:ui       # Playwright UI
pnpm test:e2e:debug    # Debug mode
pnpm test:e2e:report   # View last report
```

#### If a run goes badly wrong

A long-lived `pnpm dev` can exhaust the Vite worker's heap and then answer **500** while still
listening, which produces a large, convincing wall of failures that looks like a code regression.
`health.spec.ts` and `theme-colors.spec.ts` are the canaries — they depend on almost nothing, so
if _they_ fail, check the server before debugging code:

```bash
curl http://tenant-a.litium.portal:3000/api/health
```

A 500 there means restart the dev server. For long sessions, start it with
`NODE_OPTIONS=--max-old-space-size=8192`.

Also: don't run two suites concurrently against one server — they share cart state and corrupt
each other's assertions.

Don't run `pnpm typecheck` while `pnpm build` (or `E2E_PROD=1 pnpm test:e2e`, which builds) is
running. Both write to `.nuxt` and `node_modules/.cache/nuxt`, and the build then dies with a Rollup
"Could not resolve ./\_nuxt/virtual_nuxt…" error. `pnpm clean` and rerun.

### Run a specific tier

```bash
pnpm vitest --project node          # Only node tests
pnpm vitest --project components    # Only component tests
pnpm vitest --project nuxt          # Only nuxt tests
```

## Test Directory Structure

```
tests/
├── components/         # Vue component tests (tiers: components or nuxt)
│   ├── Button.test.ts
│   ├── Copyright.test.ts
│   ├── Logo.test.ts
│   └── layout/
│       ├── LayoutFooter.test.ts
│       ├── LayoutHeaderMain.test.ts      # nuxt tier (useRouter)
│       └── MobileNavPanel.test.ts        # nuxt tier (useRoute)
├── composables/        # Composable tests (tiers: node or nuxt)
│   ├── useCmsPreview.test.ts             # nuxt tier (mockNuxtImport)
│   ├── useErrorTracking.test.ts          # nuxt tier (useRuntimeConfig)
│   ├── useRouteResolution.test.ts
│   └── useTenant.test.ts                 # nuxt tier (useFetch)
├── e2e/               # Playwright E2E tests (12 specs, 226 tests x 3 projects)
│   ├── helpers.ts          # Shared: discoverProduct, waitForHydration, addToCart
│   ├── app.spec.ts         # App health, responsive, accessibility, perf (10)
│   ├── auth.spec.ts        # Login, register, validation, view switching (8)
│   ├── cart.spec.ts        # Add-to-cart, cart page, remove, promo (5)
│   ├── health.spec.ts      # API health, config, homepage (3)
│   ├── homepage.spec.ts    # Hero, products, CMS sections, nav, footer (5)
│   ├── navigation.spec.ts  # Header, breadcrumbs, footer, mobile nav (7)
│   ├── product-browsing.spec.ts  # PLP grid, sort, filter, PDP (8)
│   └── search.spec.ts      # Autocomplete, results page, clear (5)
├── middleware/         # Middleware tests (node tier)
│   └── feature.test.ts
├── server/            # Server tests (mostly node tier)
│   ├── api-contracts.test.ts             # nuxt tier (useNuxtApp)
│   ├── errors.test.ts
│   ├── external-api.test.ts              # nuxt tier (useRuntimeConfig)
│   ├── services/
│   │   ├── _client.test.ts
│   │   ├── sdk-services.test.ts
│   │   ├── integration.test.ts           # Hits real Geins API
│   │   └── graphql-loader.test.ts
│   └── ...
├── stores/            # Pinia store tests (node tier)
│   └── auth.test.ts
├── unit/              # General utility tests (node tier)
│   ├── constants.test.ts
│   └── utils.test.ts
├── utils/             # Test utilities
│   ├── component.ts   # mountComponent, shallowMountComponent helpers
│   └── index.ts       # mockConsole, wait, flushPromises
├── setup.ts           # Base setup: console suppression (all tiers)
├── setup-components.ts # Component tier: + Pinia init + useTenant mock
└── setup-nuxt.ts      # Nuxt tier: + registerEndpoint('/api/config')
```

## Setup Files

### `tests/setup.ts` — Base (all tiers)

Console suppression only. Keeps test output clean.

```typescript
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'debug').mockImplementation(() => {});
```

### `tests/setup-components.ts` — Component tier

Extends base setup with:

- `setActivePinia(createPinia())` — so Pinia stores work without Nuxt
- `vi.mock('../app/composables/useTenant')` — returns test tenant data matching the Nuxt tier's `registerEndpoint` mock

### `tests/setup-nuxt.ts` — Nuxt tier

Extends base setup with:

- `registerEndpoint('/api/config', () => mockTenantConfig)` — provides tenant config to `useFetch('/api/config')` in the Nuxt test environment

## Writing Tests

### Unit Tests (node tier)

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../../server/utils/myModule';

describe('myFunction', () => {
  it('should return expected value', () => {
    expect(myFunction('input')).toBe('expected');
  });
});
```

### Component Tests (components tier)

Use the `mountComponent` / `shallowMountComponent` helpers from `tests/utils/component.ts`. They provide default stubs for `NuxtLink`, `NuxtImg`, `Icon`, `ClientOnly` and mocks for `$t`, `$router`, `$route`.

```typescript
import { describe, it, expect } from 'vitest';
import { mountComponent } from '../utils/component';
import MyComponent from '../../app/components/MyComponent.vue';

describe('MyComponent', () => {
  it('should render correctly', () => {
    const wrapper = mountComponent(MyComponent, {
      props: { title: 'Hello' },
    });
    expect(wrapper.text()).toContain('Hello');
  });

  it('should emit event on click', async () => {
    const wrapper = mountComponent(MyComponent);
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('click')).toBeTruthy();
  });
});
```

### Server Tests with Logger

Server tests importing code that uses the structured logger must mock it:

```typescript
vi.mock('../../server/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createTenantLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  createRequestLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));
```

### Asserting on Console Calls

```typescript
import { mockConsole } from '../utils';

const { mocks, restore } = mockConsole();

// ... trigger code that logs
expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('failed'));

restore();
```

### Service Layer Tests

Two approaches in `tests/server/services/`:

- **Unit tests** — mock SDK calls, test service logic in isolation
- **Integration tests** — hit real Geins API with test credentials, gated by env vars

Mock data is always inlined in test files — never read from external paths (they don't exist in CI).

### Auto-Import Mocking

Nuxt auto-imports work in the node tier thanks to `getVitestConfigFromNuxt()`. For server tests using Nitro globals:

```typescript
vi.stubGlobal('getPreviewCookie', vi.fn().mockReturnValue(false));
vi.stubGlobal(
  'useRuntimeConfig',
  vi.fn(() => ({
    public: { appName: 'Test' },
    geins: { apiEndpoint: 'https://test.api' },
  })),
);
```

## E2E Tests

E2E tests run against the real dev server with real Geins API data — no mocks. Setup
prerequisites are in [Running Tests → E2E Tests](#e2e-tests-1).

### Writing tests that survive

Most historical E2E failures in this repo were not application bugs. They were these, so check
them before concluding the app is broken:

- **Ambiguous locators.** Playwright fails a locator matching more than one element, and reports
  it as **"element(s) not found" / "not visible"** — not as a strict-mode error. Several
  `data-testid`s legitimately appear twice: `search-input` (header + page), `cart-drawer`,
  `[role="tabpanel"]` (Reka UI mounts one per tab). Scope to a container (`main`,
  `[data-testid="mobile-search-panel"]`) rather than reaching for `.first()`.
- **`role="dialog"` is not unique.** `CookieBanner.vue` carries it, so it collides with any sheet
  or filter panel. The consent state is pre-seeded in `playwright.config.ts` so the banner never
  renders — if you add another persistent dialog, expect the same class of collision.
- **Responsive layouts render twice.** `ProductTabs.vue` renders Tabs (`hidden md:block`) _and_ an
  Accordion (`md:hidden`); the header SearchBar is `hidden … lg:flex`. Elements exist in the DOM
  while invisible, so a click waits forever. Branch on which layout is actually visible, or skip
  on the projects where the affordance does not exist (`test.skip(isMobile, …)`).
- **Hydration.** Anything driven by a Vue handler needs `waitForHydration(page)` first, or the
  click lands on inert SSR markup and nothing happens.
- **WebKit commits URLs late.** `page.url()` (and `waitForLoadState`) can still report the previous
  path after a navigation has returned 200. Use `page.waitForURL(...)` and assert the same
  condition you waited for — never sample the URL.

### Key patterns

**Dynamic data discovery** — tests don't hardcode slugs or IDs:

```typescript
import { discoverProduct, discoverCategory } from './helpers';

const product = await discoverProduct(page); // Fetches /api/product-lists/products
const category = await discoverCategory(page); // Fetches /api/cms/menu
```

**Hydration wait** — SSR renders HTML immediately but Vue event handlers only attach after hydration. Always call `waitForHydration(page)` before interacting with reactive elements:

```typescript
import { waitForHydration } from './helpers';

await page.goto('/some-page');
await page.waitForLoadState('load');
await waitForHydration(page); // Checks __vue_app__ + 1s stabilization
```

**pressSequentially for v-model** — `fill()` sets values programmatically and may not trigger Vue's watch chain. Use `pressSequentially()` for search inputs and other watched fields:

```typescript
await searchInput.click();
await searchInput.pressSequentially(searchTerm, { delay: 50 });
```

**Retry clicks for hydration-sensitive elements** — hydration mismatch patching can leave event handlers temporarily unattached:

```typescript
for (let attempt = 0; attempt < 3; attempt++) {
  await button.click();
  const opened = await dialog
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (opened) break;
}
```

## Coverage

V8 coverage provider. Reports: HTML (`coverage/index.html`), JSON, terminal text.

| Metric     | Target |
| ---------- | ------ |
| Lines      | 80%    |
| Functions  | 80%    |
| Branches   | 75%    |
| Statements | 80%    |

Excludes: `app/components/ui/**` (shadcn-vue), `*.d.ts`, `node_modules`, `.nuxt`

## CI/CD Integration

See `.github/workflows/ci.yml`. It runs on **PRs into `main`/`production`** and on **pushes to
`dev`** — not on every push.

| Job               | When     | What                                       |
| ----------------- | -------- | ------------------------------------------ |
| Lint & Type Check | both     | `pnpm lint`, `pnpm typecheck`              |
| Unit & Component  | both     | `pnpm test:coverage` (full vitest suite)   |
| E2E               | PRs only | **A 4-file smoke subset on chromium only** |

The E2E job runs exactly:

```
--project=chromium health.spec.ts app.spec.ts homepage.spec.ts csp-policy.spec.ts
```

That is **18 of 226 tests**. Be aware of what this does and does not buy you:

- Those four files make no data-discovery calls and need no test account, which is why they were
  chosen — CI has no working Geins credentials.
- Consequently they pass even against a completely unreachable backend. A green E2E job is **not**
  evidence that the storefront works.
- The other 8 spec files, and the `Mobile Chrome` / `webkit` projects, are ungated. They rot
  silently; assume they are broken unless someone has run them locally.
- `theme-colors.spec.ts` is a deliberate WebKit regression guard, but CI installs chromium only
  and passes `--project=chromium`, so **it runs nowhere in CI** despite the comment in
  `playwright.config.ts` implying otherwise.

Running the full suite in CI would need a test account in GitHub Secrets (see
[E2E Tests](#e2e-tests)). Until that exists, **run `pnpm test:e2e` locally before a PR that
touches storefront behaviour** — the smoke subset will not catch it.

## Gotchas

### Nuxt component name resolution

Nuxt prefixes component names from `ui/` directory with `Ui` (e.g., `Sheet` becomes `UiSheet`). When stubbing in component tests, provide both names:

```typescript
const stubs = {
  Sheet: { template: '<div><slot /></div>' },
  UiSheet: { template: '<div><slot /></div>' }, // Nuxt-prefixed
};
```

### CSP + COOP in E2E

Filter CSP inline style violations and COOP header warnings in E2E console error assertions.

### `destr` type coercion

Nuxt's `useCookie` decodes `'true'` to boolean `true` via destr. Use `useCookie<boolean | string | null>` and check both types.

### Preview cookie in server tests

Server tests calling CMS/service functions need:

```typescript
vi.stubGlobal('getPreviewCookie', vi.fn().mockReturnValue(false));
```

## Debugging

```bash
# Run specific test file
pnpm vitest tests/unit/utils.test.ts

# Run tests matching pattern
pnpm vitest -t "should render"

# Verbose output
pnpm vitest --reporter=verbose

# Debug Playwright
pnpm exec playwright test tests/e2e/app.spec.ts --debug
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vue Test Utils Guide](https://test-utils.vuejs.org/)
- [Playwright Documentation](https://playwright.dev/)
- [Nuxt Testing Documentation](https://nuxt.com/docs/getting-started/testing)

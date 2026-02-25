---
outline: deep
---

# Testing Guide

Testing strategy, architecture, and practices for the Sales Portal.

## Overview

1219 tests across 90 files, running in ~30s via a 3-tier Vitest workspace.

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

## Running Tests

### Unit and Component Tests

```bash
pnpm test              # Run all tests once
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage report
pnpm test:ui           # Vitest visual UI
```

### E2E Tests

E2E tests require a tenant hostname. Add to `/etc/hosts`:

```
127.0.0.1 tenant-a.litium.portal
```

```bash
pnpm test:e2e          # Headless
pnpm test:e2e:ui       # Playwright UI
pnpm test:e2e:debug    # Debug mode
pnpm test:e2e:report   # View last report
```

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
├── e2e/               # Playwright E2E tests
│   ├── app.spec.ts
│   └── health.spec.ts
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

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature', () => {
  test('should complete user flow', async ({ page }) => {
    await page.goto('/');
    await page.click('button[data-testid="submit"]');
    await expect(page.locator('.success-message')).toBeVisible();
  });
});
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

Tests run on every push and PR:

1. Lint + TypeScript checks
2. Unit + component tests (Vitest with coverage)
3. E2E tests (Playwright with Chromium)

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

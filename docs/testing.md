---
outline: deep
---

# Testing Guide

This document describes the testing strategy and practices for the Sales Portal application.

## Overview

The Sales Portal uses a comprehensive testing approach with multiple levels:

1. **Unit Tests** - Test individual functions and utilities
2. **Component Tests** - Test Vue components in isolation
3. **Integration Tests** - Test server-side logic and API endpoints
4. **E2E Tests** - Test complete user flows in a browser

## Test Stack

- **Vitest** - Fast unit test framework with Vue support
- **@nuxt/test-utils** - Nuxt-specific testing utilities
- **@vue/test-utils** - Vue component testing utilities
- **Playwright** - E2E testing with real browsers
- **happy-dom** - Fast DOM implementation for unit tests

## Running Tests

### Unit and Component Tests

```bash
# Run all unit/component tests once
pnpm test

# Run tests in watch mode (development)
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage

# Open Vitest UI (visual test runner)
pnpm test:ui
```

### E2E Tests

E2E tests require a tenant hostname. Add to `/etc/hosts`:

```
127.0.0.1 tenant-a.litium.portal
```

```bash
# Run E2E tests headlessly
pnpm test:e2e

# Open Playwright UI for debugging
pnpm test:e2e:ui

# Run E2E tests in debug mode
pnpm test:e2e:debug

# View the last test report
pnpm test:e2e:report
```

### Run All Tests

```bash
# Run both unit and E2E tests
pnpm test:all
```

## Test Directory Structure

```
tests/
├── components/         # Vue component tests
│   └── Button.test.ts
├── composables/        # Composable function tests
│   ├── useErrorTracking.test.ts
│   ├── useRouteResolution.test.ts
│   └── useTenant.test.ts
├── e2e/               # Playwright E2E tests
│   ├── app.spec.ts
│   └── health.spec.ts
├── middleware/         # Middleware tests
│   └── feature.test.ts
├── server/            # Server-side unit tests
│   ├── api-contracts.test.ts
│   ├── errors.test.ts
│   ├── external-api.test.ts
│   ├── logger.test.ts
│   ├── resolve-route.test.ts
│   └── tenant.test.ts
├── stores/            # Pinia store tests
│   └── auth.test.ts
├── unit/              # General utility unit tests
│   ├── constants.test.ts
│   └── utils.test.ts
└── utils/             # Test utilities and helpers
    ├── api-client.test.ts
    ├── index.ts
    └── component.ts
```

## Writing Tests

### Unit Tests

Unit tests should test individual functions in isolation:

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../../app/lib/myModule';

describe('myFunction', () => {
  it('should return expected value', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Component Tests

Component tests use Vue Test Utils to mount and interact with components:

```typescript
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MyComponent from '../../app/components/MyComponent.vue';

describe('MyComponent', () => {
  it('should render correctly', () => {
    const wrapper = mount(MyComponent, {
      props: {
        title: 'Hello',
      },
    });

    expect(wrapper.text()).toContain('Hello');
  });

  it('should emit event on click', async () => {
    const wrapper = mount(MyComponent);

    await wrapper.find('button').trigger('click');

    expect(wrapper.emitted('click')).toBeTruthy();
  });
});
```

### E2E Tests

E2E tests use Playwright to test complete user flows:

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

## Test Utilities

### Common Helpers

The `tests/utils/index.ts` file provides common test utilities:

```typescript
import {
  createMockLocalStorage,
  createMockTenantConfig,
  wait,
  flushPromises,
} from '../utils';

// Mock localStorage
const mockStorage = createMockLocalStorage();

// Create mock tenant config
const tenantConfig = createMockTenantConfig({ id: 'test-tenant' });

// Wait for async operations
await wait(100);

// Flush all pending promises
await flushPromises();
```

### Component Test Helpers

The `tests/utils/component.ts` file provides Vue component testing helpers:

```typescript
import {
  mountComponent,
  shallowMountComponent,
  expectEmitted,
} from '../utils/component';

// Mount with default options
const wrapper = mountComponent(MyComponent, { props: { ... } });

// Check emitted events
expectEmitted(wrapper, 'click');
```

## Coverage

Test coverage is tracked using V8 coverage provider. Coverage reports are generated in:

- **HTML Report**: `coverage/index.html`
- **JSON Report**: `coverage/coverage-final.json`
- **Text Summary**: Displayed in terminal

### Coverage Thresholds

We aim for the following coverage targets:

| Metric     | Target |
| ---------- | ------ |
| Lines      | 80%    |
| Functions  | 80%    |
| Branches   | 75%    |
| Statements | 80%    |

Coverage excludes:

- `app/components/ui/**` - shadcn-vue components (pre-tested)
- `**/*.d.ts` - TypeScript declaration files
- `**/node_modules/**` - Dependencies
- `**/.nuxt/**` - Nuxt build artifacts

## CI/CD Integration

Tests run automatically on every push and pull request:

1. **Lint & Type Check** - ESLint and TypeScript checks
2. **Unit & Component Tests** - Vitest with coverage
3. **E2E Tests** - Playwright with Chromium

Coverage reports are uploaded to Codecov for tracking over time.

## Best Practices

### General

1. **Test behavior, not implementation** - Focus on what the code does, not how
2. **One assertion focus per test** - Each test should verify one specific behavior
3. **Use descriptive names** - Test names should describe the expected behavior
4. **Keep tests isolated** - Tests should not depend on each other

### Component Tests

1. **Test user interactions** - Click, type, focus, etc.
2. **Test accessibility** - Keyboard navigation, ARIA attributes
3. **Mock external dependencies** - API calls, router, store
4. **Use data-testid for selectors** - More stable than CSS classes

### E2E Tests

1. **Test critical paths** - Focus on important user journeys
2. **Use realistic data** - Test with data similar to production
3. **Handle async properly** - Use proper waiting strategies
4. **Run in CI** - Ensure tests pass in clean environments

## Debugging Tests

### Vitest

```bash
# Run specific test file
pnpm vitest tests/unit/utils.test.ts

# Run tests matching pattern
pnpm vitest -t "should render"

# Enable verbose output
pnpm vitest --reporter=verbose
```

### Playwright

```bash
# Debug specific test file
pnpm exec playwright test tests/e2e/app.spec.ts --debug

# Run with headed browser
pnpm exec playwright test --headed

# Generate trace for debugging
pnpm exec playwright test --trace on
```

## Mocking

### Vitest Mocks

```typescript
import { vi } from 'vitest';

// Mock useFetch
vi.mock('#app', () => ({
  useFetch: () => ({
    data: ref(null),
    error: ref(null),
    pending: ref(false),
  }),
}));

// Mock a function
const mockFn = vi.fn().mockReturnValue('mocked');

// Mock timers
vi.useFakeTimers();
vi.advanceTimersByTime(1000);
vi.useRealTimers();
```

### Environment Variables

```typescript
import { vi } from 'vitest';

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
});

afterEach(() => {
  vi.unstubAllEnvs();
});
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vue Test Utils Guide](https://test-utils.vuejs.org/)
- [Playwright Documentation](https://playwright.dev/)
- [Nuxt Testing Documentation](https://nuxt.com/docs/getting-started/testing)

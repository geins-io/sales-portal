# Sales Portal - Refactor Plan

This document outlines identified bugs, issues, and optimization opportunities in the Sales Portal codebase, along with the expected gains from addressing each item.

---

## Table of Contents

- [Critical Bugs](#critical-bugs)
- [Medium Priority Issues](#medium-priority-issues)
- [Code Quality Improvements](#code-quality-improvements)
- [Performance Optimizations](#performance-optimizations)
- [Security Enhancements](#security-enhancements)
- [Architecture Improvements](#architecture-improvements)
- [Testing Gaps](#testing-gaps)

---

## Critical Bugs

These issues cause incorrect behavior and should be addressed immediately.

### 1. Unreachable Code in Route Resolver Stubs

**File:** `server/api/resolve-route.get.ts` (lines 27-33, 39-45)

**Issue:** The `lookupCategoryBySlug` and `lookupPageBySlug` functions have `return` statements followed by unreachable `return null` statements.

```typescript
// Current (buggy)
async function lookupCategoryBySlug(_slug: string) {
  return { id: '1', canonical: 'https://example.com/category-slug' };
  return null; // UNREACHABLE
}
```

**Impact:** While currently these are placeholder stubs, this pattern sets a dangerous precedent and the unreachable code will never execute when real implementations are added.

**Fix:** Remove the unreachable `return null` statements and add proper TODO comments for implementation.

**Gain:** Cleaner code, prevents confusion when implementing real lookups.

---

### 2. Disabled Tenant Initialization Plugin

**File:** `server/plugins/00.tenant-init.ts` (lines 5-6)

**Issue:** The `return false;` statement makes the entire tenant initialization unreachable.

```typescript
export default defineNitroPlugin(async (_nitroApp) => {
  return false; // BUG: Early return makes code below unreachable
  await createTenant({...}); // Never executes
});
```

**Impact:** Development tenants are never pre-seeded, forcing reliance on auto-creation in config.get.ts.

**Fix:** Remove the early return or properly conditionally enable/disable based on environment.

**Gain:** Enables proper development tenant seeding, improves DX.

---

### 3. Typo in CSS Sanitization

**File:** `app/plugins/tenant-theme.ts` (line 2)

**Issue:** The regex pattern has a typo: `st<yle>` instead of `<style>`.

```typescript
// Current (buggy)
return css.replace(/st<yle>|<\/style>/g, '').trim();

// Should be
return css.replace(/<style>|<\/style>/gi, '').trim();
```

**Impact:** Malicious `<style>` tags in tenant CSS won't be properly sanitized, creating XSS vulnerability potential.

**Fix:** Correct the regex and add case-insensitive flag.

**Gain:** Proper security, prevents CSS injection attacks.

---

### 4. HTML Entities in Default Layout

**File:** `app/layouts/default.vue` (lines 6-9)

**Issue:** The template contains HTML entities that render as visible text instead of semantic HTML.

```vue
<main>
  &lt;main&gt;  <!-- Renders as visible "<main>" text -->
  <br />
  <slot />
  &lt;main /&gt;  <!-- Renders as visible "<main />" text -->
</main>
```

**Impact:** Users see literal `<main>` and `<main />` text in the rendered page.

**Fix:** Remove the HTML entities or replace with proper content/comments.

**Gain:** Correct visual output, professional appearance.

---

### 5. Missing Type Import in Tenant Theme Plugin

**File:** `app/plugins/tenant-theme.ts`

**Issue:** `TenantConfig` type is used but never imported, relying on auto-import magic that may fail.

```typescript
// Missing import
import type { TenantConfig } from '#shared/types/tenant-config';
```

**Impact:** Potential TypeScript errors in strict mode, unclear dependencies.

**Fix:** Add explicit import statement.

**Gain:** Type safety, clearer dependencies, better IDE support.

---

## Medium Priority Issues

These issues affect reliability, maintainability, or user experience.

### 6. Memory Leak in Route Cache

**File:** `server/api/resolve-route.get.ts` (line 17)

**Issue:** The `routeCache` Map can grow unbounded. While entries expire, they're only cleaned up when accessed.

```typescript
const routeCache = new Map<string, CacheEntry>();
// No max size limit, no periodic cleanup
```

**Impact:** Memory usage grows continuously in long-running processes, potential OOM crashes.

**Fix:** Implement LRU cache with max size limit, or add periodic cleanup.

```typescript
// Option 1: Use a proper LRU cache
import { LRUCache } from 'lru-cache';
const routeCache = new LRUCache<string, CacheEntry>({ max: 1000 });

// Option 2: Add periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of routeCache) {
    if (entry.expiresAt <= now) routeCache.delete(key);
  }
}, 60000);
```

**Gain:** Stable memory usage, prevents production crashes.

---

### 7. Hardcoded Authentication Placeholders

**Files:** `app/middleware/auth.ts`, `app/middleware/guest.ts`

**Issue:** Both middlewares have `const isAuthenticated = false` hardcoded.

**Impact:** Authentication middleware is non-functional, all protected routes will redirect to login.

**Fix:** Implement proper authentication state management (session, JWT, etc.).

**Gain:** Working authentication system, secure protected routes.

---

### 8. Type Escape Hatch in Feature Middleware

**File:** `app/middleware/feature.ts` (line 23)

**Issue:** Using `as never` type assertion is a code smell indicating type system issues.

```typescript
if (requiredFeature && !hasFeature(requiredFeature as never)) {
```

**Impact:** Type errors are suppressed, potential runtime issues.

**Fix:** Properly type the route meta or use a type guard.

```typescript
// Better approach
type FeatureName = keyof NonNullable<TenantConfig['features']>;
const requiredFeature = to.meta.feature as FeatureName | undefined;
if (requiredFeature && !hasFeature(requiredFeature)) {
```

**Gain:** Type safety, better IDE support, catch errors at compile time.

---

### 9. Missing Error Handling in External API Proxy

**File:** `server/api/external/[...].ts`

**Issue:** No try/catch, no error transformation, no timeout handling.

```typescript
export default defineEventHandler(async (event) => {
  // No error handling at all
  return sendProxy(event, target, {...});
});
```

**Impact:** External API failures surface as cryptic 500 errors to clients.

**Fix:** Add comprehensive error handling with proper error messages.

```typescript
export default defineEventHandler(async (event) => {
  try {
    // ... existing code ...
    return sendProxy(event, target, {
      fetchOptions: {
        ...existingOptions,
        signal: AbortSignal.timeout(30000), // Add timeout
      },
    });
  } catch (error) {
    throw createExternalApiError('External API', error as Error);
  }
});
```

**Gain:** Better error messages, timeout protection, consistent error handling.

---

### 10. useDebounce Missing Cleanup

**File:** `app/composables/useDebounce.ts`

**Issue:** The timeout is never cleaned up when the component unmounts.

```typescript
export function useDebounce<T>(value: Ref<T>, delay: number = 300): Ref<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  // No onUnmounted cleanup!
```

**Impact:** Memory leaks, potential state updates on unmounted components.

**Fix:** Add cleanup on unmount.

```typescript
import { onUnmounted } from 'vue';

export function useDebounce<T>(value: Ref<T>, delay: number = 300): Ref<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  onUnmounted(() => {
    if (timeout) clearTimeout(timeout);
  });
  // ... rest of implementation
```

**Gain:** Prevents memory leaks, prevents React-style "Can't update unmounted component" warnings.

---

### 11. useLocalStorage Lifecycle Issue

**File:** `app/composables/useLocalStorage.ts` (lines 59-65)

**Issue:** `onUnmounted` is called inside the `if (import.meta.client)` block synchronously, not as a lifecycle hook registration.

**Impact:** The cleanup handler registration is correct, but the nesting is confusing and could lead to issues if refactored.

**Fix:** Restructure to make lifecycle hook usage clearer.

**Gain:** Clearer code, less error-prone during refactoring.

---

### 12. SSR Hydration Mismatch in useMediaQuery

**File:** `app/composables/useMediaQuery.ts`

**Issue:** `matches` ref initializes as `false` on SSR, but may be `true` on client, causing hydration mismatch.

```typescript
export function useMediaQuery(query: string) {
  const matches = ref(false); // Always false on server
  // Updated in onMounted - after hydration
```

**Impact:** Console warnings about hydration mismatch, potential visual glitches.

**Fix:** Use `useState` or accept server default, or use `v-if="$client"` pattern.

```typescript
// Option: Document the behavior and handle in components
export function useMediaQuery(query: string) {
  const matches = ref(false);
  const isHydrated = ref(false);

  onMounted(() => {
    isHydrated.value = true;
    // ... rest of code
  });

  return { matches, isHydrated };
}
```

**Gain:** Cleaner hydration, no console warnings.

---

## Code Quality Improvements

### 13. Duplicate Theme Merging Logic

**File:** `server/utils/tenant.ts`

**Issue:** Theme merging logic is duplicated in `createTenant`, `updateTenant`, and the partial config merge section.

**Fix:** Extract into a reusable `mergeThemes` utility function.

```typescript
function mergeThemes(
  base: TenantTheme,
  updates?: Partial<TenantTheme>,
): TenantTheme {
  if (!updates) return base;
  return {
    ...base,
    ...updates,
    colors: { ...base.colors, ...updates.colors },
    borderRadius: { ...base.borderRadius, ...updates.borderRadius },
    typography: { ...base.typography, ...updates.typography },
    customProperties: { ...base.customProperties, ...updates.customProperties },
  };
}
```

**Gain:** DRY code, single source of truth for theme merging, easier to maintain.

---

### 14. Magic Strings for Storage Keys

**Files:** `server/utils/tenant.ts`, various

**Issue:** Storage key patterns like `tenant:id:` and `tenant:config:` are scattered.

**Fix:** Centralize in constants.

```typescript
// shared/constants/storage.ts
export const STORAGE_KEYS = {
  TENANT_ID_PREFIX: 'tenant:id:',
  TENANT_CONFIG_PREFIX: 'tenant:config:',
} as const;
```

**Gain:** Single source of truth, easier refactoring, prevents typos.

---

### 15. Inconsistent Error Handling Patterns

**Files:** Various server files

**Issue:** Mix of `withErrorHandling`, try/catch, and no error handling at all.

**Fix:** Establish and document consistent patterns, use `withErrorHandling` wrapper consistently.

**Gain:** Consistent error reporting, easier debugging, uniform API error responses.

---

### 16. Console.warn in Production Code

**File:** `app/middleware/feature.ts` (line 26)

**Issue:** Using `console.warn` instead of proper logging.

```typescript
console.warn(`Feature "${requiredFeature}" is not enabled for this tenant`);
```

**Fix:** Use the error tracking composable or remove in production.

**Gain:** Cleaner console, proper log aggregation.

---

## Performance Optimizations

### 17. Memoize CSS Generation

**File:** `server/utils/tenant.ts`

**Issue:** `generateTenantCss` is called on every tenant fetch, even when theme hasn't changed.

**Fix:** Store CSS in the config and only regenerate when theme changes.

```typescript
// Already doing this, but ensure CSS is only regenerated on theme change
const themeHash = JSON.stringify(theme);
const existingHash = existing.themeHash;
if (themeHash !== existingHash) {
  config.css = generateTenantCss(theme);
  config.themeHash = themeHash;
}
```

**Gain:** Reduced CPU usage, faster config responses.

---

### 18. Add Route Prefetching

**File:** `app/pages/[...slug].vue`

**Issue:** Route resolution happens after navigation, causing loading states.

**Fix:** Add route prefetching on link hover.

```typescript
// In navigation components
const prefetchRoute = (path: string) => {
  $fetch('/api/resolve-route', { query: { path } });
};
```

**Gain:** Perceived faster navigation, better UX.

---

### 19. Optimize useBreakpoints

**File:** `app/composables/useMediaQuery.ts`

**Issue:** `useBreakpoints` creates 5 separate MediaQueryList listeners plus a resize listener.

**Fix:** Use a single resize listener with debouncing.

```typescript
export function useBreakpoints() {
  const width = ref(0);

  // Single resize listener with debounce
  onMounted(() => {
    const updateWidth = debounce(() => {
      width.value = window.innerWidth;
    }, 100);

    width.value = window.innerWidth;
    window.addEventListener('resize', updateWidth);
    onUnmounted(() => window.removeEventListener('resize', updateWidth));
  });

  // Computed values from width
  const isSm = computed(() => width.value >= BREAKPOINTS.SM);
  // ... etc
}
```

**Gain:** Fewer event listeners, better performance on resize.

---

### 20. Add Request Deduplication

**File:** `app/composables/useApi.ts`

**Issue:** Same API endpoints can be called multiple times simultaneously.

**Fix:** Add request deduplication/coalescing.

```typescript
const pendingRequests = new Map<string, Promise<unknown>>();

export function useApi<T>(url: string, options?: UseFetchOptions<T>) {
  const key = `${url}-${JSON.stringify(options)}`;

  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>;
  }
  // ... implementation
}
```

**Gain:** Reduced API calls, less server load, faster responses.

---

## Security Enhancements

### 21. Add Rate Limiting to Error Endpoint

**File:** `server/api/log/error.post.ts`

**Issue:** No rate limiting allows DoS via error flooding.

**Fix:** Add rate limiting middleware.

```typescript
// Using a simple in-memory rate limiter
const rateLimiter = new Map<string, number[]>();
const RATE_LIMIT = 10; // 10 errors per minute per IP

export default defineEventHandler(async (event) => {
  const ip = getClientIp(event);
  const now = Date.now();
  const requests = rateLimiter.get(ip) || [];
  const recent = requests.filter((t) => now - t < 60000);

  if (recent.length >= RATE_LIMIT) {
    throw createError({ statusCode: 429, message: 'Too many requests' });
  }

  rateLimiter.set(ip, [...recent, now]);
  // ... rest of implementation
});
```

**Gain:** Protection against error flooding attacks, more stable logging.

---

### 22. Validate Tenant Hostname Format

**File:** `server/utils/tenant.ts`

**Issue:** No validation on hostname format allows invalid data.

**Fix:** Add hostname validation.

```typescript
const HOSTNAME_REGEX =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;

export function validateHostname(hostname: string): boolean {
  return HOSTNAME_REGEX.test(hostname) && hostname.length <= 253;
}

export async function createTenant(options: CreateTenantOptions) {
  if (!validateHostname(options.hostname)) {
    throw createAppError(ErrorCode.VALIDATION_ERROR, 'Invalid hostname format');
  }
  // ... rest of implementation
}
```

**Gain:** Data integrity, prevents invalid storage keys.

---

### 23. Sanitize Error Messages in Production

**File:** `server/utils/errors.ts`

**Issue:** Error details may leak sensitive information.

**Fix:** Strip internal details in production responses.

```typescript
export function createAppError(
  code: ErrorCode,
  message?: string,
  details?: Record<string, unknown>,
) {
  const isDev = process.env.NODE_ENV === 'development';

  return createError({
    statusCode: ERROR_STATUS_CODES[code],
    message: isDev ? message || ERROR_MESSAGES[code] : ERROR_MESSAGES[code],
    data: isDev ? { code, details } : { code },
  });
}
```

**Gain:** Prevents information leakage, more secure production errors.

---

## Architecture Improvements

### 24. Extract API Client Configuration

**File:** `app/plugins/api.ts`

**Issue:** Limited configuration options, no retry logic, no interceptors.

**Fix:** Create a more robust API client.

```typescript
// app/utils/api-client.ts
export function createApiClient(config: ApiClientConfig) {
  return $fetch.create({
    baseURL: config.baseUrl,
    retry: config.retry ?? 3,
    retryDelay: config.retryDelay ?? 1000,
    timeout: config.timeout ?? 30000,
    onRequest: config.onRequest,
    onResponse: config.onResponse,
    onRequestError: config.onRequestError,
    onResponseError: config.onResponseError,
  });
}
```

**Gain:** More robust API communication, automatic retries, better error handling.

---

### 25. Implement State Management for Auth

**Files:** `app/middleware/auth.ts`, `app/middleware/guest.ts`, `app/stores/`

**Issue:** No centralized auth state management.

**Fix:** Create an auth store using Pinia.

```typescript
// app/stores/auth.ts
export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    token: null as string | null,
    isLoading: false,
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
  },
  actions: {
    async login(credentials: LoginCredentials) { ... },
    async logout() { ... },
    async refreshToken() { ... },
  },
});
```

**Gain:** Centralized auth state, reactive authentication, proper logout handling.

---

### 26. Add Composable for Route Resolution

**File:** `app/pages/[...slug].vue`

**Issue:** Route resolution logic is embedded in the page component.

**Fix:** Extract into a reusable composable.

```typescript
// app/composables/useRouteResolution.ts
export function useRouteResolution(path: MaybeRefOrGetter<string>) {
  return useAsyncData<RouteResolution>(
    () => `route-resolution:${toValue(path)}`,
    () => $fetch('/api/resolve-route', { query: { path: toValue(path) } }),
    { watch: [() => toValue(path)] },
  );
}
```

**Gain:** Reusable logic, easier testing, cleaner page components.

---

## Testing Gaps

### 27. Missing Tests for Core Composables

**Files:** Various composables

**Issue:** `useApi`, `useTenant`, `useErrorTracking`, `useMediaQuery` lack unit tests.

**Fix:** Add comprehensive tests.

```typescript
// tests/composables/useApi.test.ts
describe('useApi', () => {
  it('should make API calls with correct headers', async () => { ... });
  it('should handle errors gracefully', async () => { ... });
  it('should pass tenant headers', async () => { ... });
});
```

**Gain:** Confidence in refactoring, regression prevention, documentation.

---

### 28. Missing Integration Tests for Tenant Flow

**Issue:** No end-to-end tests for tenant resolution and theming.

**Fix:** Add Playwright tests for multi-tenant scenarios.

```typescript
// tests/e2e/tenant.spec.ts
test.describe('Multi-tenant functionality', () => {
  test('should load correct theme for tenant A', async ({ page }) => { ... });
  test('should load correct theme for tenant B', async ({ page }) => { ... });
  test('should handle unknown tenant gracefully', async ({ page }) => { ... });
});
```

**Gain:** Confidence in tenant isolation, catch regressions early.

---

### 29. Add API Contract Tests

**Issue:** No tests verifying API response shapes.

**Fix:** Add schema validation tests.

```typescript
// tests/server/api-contracts.test.ts
import { z } from 'zod';

const TenantConfigSchema = z.object({
  tenantId: z.string(),
  hostname: z.string(),
  theme: z.object({ ... }),
  // ...
});

describe('API Contracts', () => {
  it('GET /api/config returns valid TenantConfig', async () => {
    const response = await $fetch('/api/config');
    expect(() => TenantConfigSchema.parse(response)).not.toThrow();
  });
});
```

**Gain:** API stability, catch breaking changes, documentation.

---

## Implementation Priority

| Priority              | Items                             | Effort     | Impact      |
| --------------------- | --------------------------------- | ---------- | ----------- |
| **P0 - Critical**     | #1, #2, #3, #4, #5                | Low        | High        |
| **P1 - High**         | #6, #7, #9, #21, #22              | Medium     | High        |
| **P2 - Medium**       | #8, #10, #11, #12, #13, #14       | Low-Medium | Medium      |
| **P3 - Low**          | #15, #16, #17, #18, #19, #20      | Medium     | Medium      |
| **P4 - Nice to Have** | #23, #24, #25, #26, #27, #28, #29 | High       | Medium-High |

---

## Quick Wins (< 30 minutes each)

1. Fix unreachable code (#1, #2)
2. Fix CSS sanitization typo (#3)
3. Fix default.vue HTML entities (#4)
4. Add missing import (#5)
5. Add cleanup to useDebounce (#10)
6. Remove console.warn (#16)

---

## Next Steps

1. Create GitHub issues for each item in this document
2. Prioritize P0 items for immediate fix
3. Schedule P1 items for next sprint
4. Add P2/P3 items to backlog
5. Plan P4 architecture improvements for future milestone

---

_Document created: January 2026_
_Last updated: January 2026_

# Implementation Patterns

Reusable patterns for common tasks.

## Data Fetching

### Component with Server Data

```vue
<script setup lang="ts">
interface Product {
  id: string;
  name: string;
}

const {
  data: products,
  pending,
  error,
  refresh,
} = useFetch<Product[]>('/api/products', { dedupe: 'defer' });
</script>

<template>
  <div v-if="pending">Loading...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <ul v-else>
    <li v-for="product in products" :key="product.id">
      {{ product.name }}
    </li>
  </ul>
</template>
```

### Server Route with External API

```typescript
// server/api/products.get.ts
export default defineEventHandler(
  withErrorHandling(async (event) => {
    const config = useRuntimeConfig(event);
    const { hostname } = event.context.tenant;

    const products = await $fetch(
      `${config.externalApiBaseUrl}/${hostname}/products`,
    );

    return products;
  }),
);
```

## Multi-Tenancy

### Tenant-Aware Component

Features are keyed by string name (e.g., `'search'`, `'cart'`, `'wishlist'`). Each feature is `{ enabled: boolean, access?: ... }` — `hasFeature()` checks `.enabled`.

```vue
<script setup>
const { tenant, hasFeature, brandName } = useTenant();
</script>

<template>
  <header>
    <h1>{{ brandName }}</h1>
    <nav v-if="hasFeature('wishlist')">
      <a href="/wishlist">Wishlist</a>
    </nav>
  </header>
</template>
```

### Tenant-Aware Server Route

```typescript
export default defineEventHandler(async (event) => {
  const { id, hostname } = event.context.tenant;

  // Use tenant context
  const data = await getTenantData(id);

  return data;
});
```

## Feature Access Control

Two levels of feature checks:

- **`hasFeature(name)`** — simple "is it enabled?" check (`.enabled` only). Use in templates for UI visibility.
- **`canAccess(name)`** — full access evaluation (`.enabled` + `.access` rules: auth, role, group, etc.). Use when access control matters.

### Client-side — template gating

```vue
<script setup>
const { hasFeature } = useTenant();
const { canAccess } = useFeatureAccess();
</script>

<template>
  <!-- Simple: is feature on? -->
  <SearchBar v-if="hasFeature('search')" />

  <!-- Access-controlled: does the user have permission? -->
  <QuoteButton v-if="canAccess('quotes')" />
</template>
```

### Client-side — route middleware

```vue
<script setup>
definePageMeta({
  middleware: 'feature',
  feature: 'quotes', // Evaluates canAccess() — checks both enabled + access rules
});
</script>
```

### Server-side — route handler

```typescript
export default defineEventHandler(async (event) => {
  const tokens = await optionalAuth(event);
  await assertFeatureAccess(event, 'quotes', {
    authenticated: !!tokens,
    customerType: tokens?.user?.customerType,
  });

  // Feature is accessible — proceed
});
```

### Access rule types

| Rule                     | Behavior                                   |
| ------------------------ | ------------------------------------------ |
| `'all'`                  | Everyone                                   |
| `'authenticated'`        | Logged-in users only                       |
| `{ role: 'wholesale' }`  | Matches `user.customerType` from Geins     |
| `{ group: 'staff' }`     | Not yet available in Geins API (safe deny) |
| `{ accountType: 'ent' }` | Not yet available in Geins API (safe deny) |
| _(no access field)_      | Defaults to `'all'`                        |

## Forms

### Debounced Search

```vue
<script setup>
import { useDebounceFn } from '@vueuse/core'

const query = ref('')
const { data: results } = useFetch(() => `/api/search?q=${query.value}`, {
  dedupe: 'defer',
  watch: [query]
})

const onInput = useDebounceFn((value: string) => {
  query.value = value
}, 300)
</script>

<template>
  <input @input="(e) => onInput(e.target.value)" placeholder="Search..." />
  <ul>
    <li v-for="result in results" :key="result.id">{{ result.name }}</li>
  </ul>
</template>
```

## Cookie Handling

All cookie operations go through `server/utils/cookies.ts` (see [ADR-006](../adr/006-cookie-utility-module.md)).

### Setting auth cookies after login/register

```typescript
// server/api/auth/login.post.ts
const { tokens, user } = result;

setAuthCookies(event, {
  token: tokens.token!,
  refreshToken: tokens.refreshToken!,
  expiresIn: tokens.expiresIn,
});
```

### Reading auth cookies

```typescript
// server/utils/auth.ts
const { authToken, refreshToken } = getAuthCookies(event);
```

### Clearing cookies on logout

```typescript
// server/api/auth/logout.post.ts
clearAuthCookies(event);
```

### Cookie names as constants

```typescript
import { COOKIE_NAMES } from '#shared/constants/storage';
// COOKIE_NAMES.AUTH_TOKEN, COOKIE_NAMES.REFRESH_TOKEN, etc.
```

## Analytics & Consent

Analytics requires three gates: the `NUXT_PUBLIC_FEATURES_ANALYTICS` runtime flag, the tenant `hasFeature('analytics')` check, AND user consent via `useAnalyticsConsent()`.

### Checking consent status

```typescript
const { consent } = useAnalyticsConsent();
// consent.value is false until accept() is called
```

### Cookie banner (future component)

```vue
<script setup>
const { consent, accept, revoke } = useAnalyticsConsent();
</script>

<template>
  <div v-if="!consent">
    <p>We use cookies for analytics.</p>
    <button @click="accept">Accept</button>
  </div>
</template>
```

### Storage key constants

```typescript
import { LOCAL_STORAGE_KEYS } from '#shared/constants/storage';
// LOCAL_STORAGE_KEYS.ANALYTICS_CONSENT_PREFIX → 'analytics-consent-'
// Full key: 'analytics-consent-{tenantId}'
```

## Error Handling

### Page with Error Recovery

```vue
<script setup>
const { data, error, refresh } = useFetch('/api/data');
const { trackError } = useErrorTracking();

watch(error, (err) => {
  if (err) trackError(err, { page: 'MyPage' });
});
</script>

<template>
  <div v-if="error" class="error-state">
    <p>Failed to load data</p>
    <button @click="refresh">Try Again</button>
  </div>
  <main v-else>
    <!-- content -->
  </main>
</template>
```

## Navigation Performance

### Route Prefetching on Hover

Use `prefetchRouteResolution()` on link hover to eliminate navigation delay for dynamic `[...slug]` pages:

```vue
<script setup>
import { prefetchRouteResolution } from '~/composables/useRouteResolution';

const props = defineProps<{ href: string }>();
</script>

<template>
  <NuxtLink :to="href" @mouseenter="prefetchRouteResolution(href)">
    <slot />
  </NuxtLink>
</template>
```

The prefetch function:

- Checks the client-side `_routeCache` Map first (skips if already cached)
- Calls `/api/resolve-route` and stores the result
- Silently ignores errors (best-effort)
- When the user navigates, `useRouteResolution()` finds the cached data and skips the API call

### Promise Deduplication

The auth store's `fetchUser()` deduplicates concurrent calls via a module-scoped promise:

```typescript
// Multiple callers share the same in-flight request
await Promise.all([
  authStore.fetchUser(), // Makes the $fetch call
  authStore.fetchUser(), // Returns same promise — no extra request
  authStore.fetchUser(), // Returns same promise — no extra request
]);
```

This pattern is used by `auth-init.client.ts` (fires early) and auth/guest middleware (awaits the same promise later).

---

## Server-Side Patterns

### Caching / SWR

Use `defineCachedEventHandler` with stale-while-revalidate for expensive lookups:

```typescript
// server/api/config.get.ts
export default defineCachedEventHandler(
  async (event) => {
    const { hostname } = event.context.tenant;
    // ... fetch tenant config
    return publicConfig;
  },
  {
    getKey: (event) => tenantConfigKey(event.context.tenant.hostname),
    swr: true, // Serve stale while revalidating
    maxAge: 60 * 60, // 1-hour cache
    varies: ['host', 'x-forwarded-host'], // Tenant-aware cache keys
  },
);
```

### Rate Limiting

KV-backed sliding-window rate limiter (`server/utils/rate-limiter.ts`).
Uses `useStorage('kv')` — in-memory in dev, shared across instances when KV is backed by Redis.

```typescript
import { RateLimiter, getClientIp } from '../utils/rate-limiter';

const limiter = new RateLimiter({
  limit: 10,
  windowMs: 60_000,
  prefix: 'my-endpoint',
});

export default defineEventHandler(async (event) => {
  const clientIp = getClientIp(event);
  const result = await limiter.check(clientIp);
  if (!result.allowed) {
    throw createAppError(ErrorCode.RATE_LIMITED, 'Too many requests');
  }
  // ... handle request
});
```

Pre-configured limiters: `loginRateLimiter` (5/min), `registerRateLimiter` (3/min), `refreshRateLimiter` (10/min), `errorEndpointRateLimiter` (10/min).

### Structured Logging

Always use `logger` from `server/utils/logger.ts` — never bare `console.*`:

```typescript
import {
  logger,
  createTenantLogger,
  createRequestLogger,
} from '../utils/logger';

// Default logger
logger.info('App started');
logger.error('Operation failed', error, { context: 'details' });

// Tenant-scoped (adds [tenant:hostname] prefix)
const log = createTenantLogger(hostname);
log.info('Processing order', { orderId: '123' });

// Request-scoped (adds correlation ID)
const reqLog = createRequestLogger(correlationId);
reqLog.info('Handling request', { path: '/api/products' });
```

### Service Error Handling — `wrapServiceCall`

All service functions (`server/services/*.ts`) use `wrapServiceCall` for standardized error handling. It re-throws H3 errors, maps known SDK errors to specific error codes, and wraps anything else as `EXTERNAL_API_ERROR`.

```typescript
// SDK-backed service (cart, checkout, auth, user) — with known error class
import { CartError } from '@geins/oms';

export async function getCart(cartId: string, event: H3Event) {
  const sdk = await getTenantSDK(event);
  return wrapServiceCall(
    () => sdk.oms.cart.get(cartId),
    'cart',
    CartError, // Known SDK error → maps to BAD_REQUEST
  );
}
```

```typescript
// GraphQL service (products, search, cms, brands, etc.) — no known error class
export async function getProducts(options: ProductListOptions, event: H3Event) {
  const sdk = await getTenantSDK(event);
  return wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('product-lists/products.graphql'),
        variables: { ...options, ...getRequestChannelVariables(sdk, event) },
      }),
    'product-lists',
  );
}
```

The signature: `wrapServiceCall<T>(fn, service, knownError?, errorCode?)` — defined in `server/utils/errors.ts`.

### SDK Singleton

Per-tenant lazy singleton in `server/services/_sdk.ts`. Same tenant reuses the same SDK instance:

```typescript
import { getSDK } from '../services/_sdk';

export default defineEventHandler(async (event) => {
  const sdk = getSDK(event); // Returns cached TenantSDK for this tenant
  const products = await sdk.core.products.list();
  return products;
});
```

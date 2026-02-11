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

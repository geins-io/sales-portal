# SSR & Hard-Refresh Conventions

Rules for writing pages that work correctly during both SSR (server-side render) and client-side navigation. A "hard refresh" is when the user hits F5 or navigates directly to a URL — the server renders the page from scratch.

## Template SSR Safety

During SSR, the template renders while async data from `useFetch`/`useAsyncData` may still be `null`. All template expressions that access async data MUST use null guards.

### Rules

- NEVER use `Object.keys()`, `Object.entries()`, `Object.values()`, `.filter()`, `.map()` on async data without null guards
- ALWAYS use optional chaining (`?.`) and nullish coalescing (`?? []`, `?? {}`) in template expressions
- ALWAYS use `v-if="data"` guard before `v-for="item in data.items"` blocks
- Computed properties that derive from async data MUST handle null/undefined input
- NEVER access `window`, `document`, or other browser APIs outside `import.meta.client` guards or `onMounted`

### Patterns

```vue
<!-- DO: guard computed properties -->
<script setup>
const items = computed(() => data.value?.items ?? []);
const filterCount = computed(() => Object.keys(filters.value ?? {}).length);
</script>

<!-- DON'T: assume data is always present -->
<script setup>
const items = computed(() => Object.keys(data.value.filters)); // crashes if data.value is null
</script>
```

```vue
<!-- DO: guard v-for with v-if or nullish coalescing -->
<div v-if="data?.items" v-for="item in data.items" :key="item.id">...</div>
<div v-for="item in items ?? []" :key="item.id">...</div>

<!-- DON'T: iterate over potentially null data -->
<div v-for="item in data.items" :key="item.id">...</div>
```

```vue
<!-- DO: guard browser APIs -->
<script setup>
function scrollToTop() {
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
</script>

<!-- DON'T: call browser APIs unconditionally -->
<script setup>
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' }); // crashes during SSR
}
</script>
```

## Data Fetching

### Use `useFetch` / `useAsyncData` for page-level data

Data that the page needs to render MUST be fetched in a way that runs on both SSR and client. Even when using `useFetch`/`useAsyncData`, the template may still render during SSR while the fetch is in progress -- so data can be `null` on first render. Always add null guards in templates and computed properties.

```vue
<!-- DO: runs on SSR and client -->
<script setup>
const { data, error } = await useFetch('/api/products', { dedupe: 'defer' });
</script>

<!-- DON'T: only runs on client, SSR renders blank -->
<script setup>
const data = ref(null);
onMounted(async () => {
  data.value = await $fetch('/api/products');
});
</script>
```

### Use `callOnce` for one-time side effects

When you need to trigger a store action that populates reactive state (not return data directly), use `callOnce` to run it during SSR and skip on client hydration:

```vue
<script setup>
const store = useMyStore();
callOnce('my-data', () => store.fetchData());
</script>
```

### `onMounted` is client-only

`onMounted` never runs during SSR. Use it only for:

- DOM manipulation (scrolling, focus, measurements)
- Client-only side effects (analytics, localStorage)
- Supplementary fetches that enhance (but aren't required for) the initial render

## Error Handling in Pages

### Dynamic routes MUST handle missing data

Every page with dynamic route params (`[id]`, `[alias]`, `[slug]`) must handle the case where the resource doesn't exist.

```vue
<script setup>
// Canonical pattern: see app/pages/[...slug].vue
const { data, error } = await useFetch(`/api/resource/${id}`);

if (!data.value) {
  if (import.meta.server) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      fatal: true,
    });
  } else {
    showError(createError({ statusCode: 404, statusMessage: 'Not Found' }));
  }
}
</script>
```

For store-based fetches where the data loads asynchronously (e.g., in `onMounted`), check after the fetch completes:

```vue
<script setup>
onMounted(async () => {
  await store.fetchResource(id);
  if (!store.currentResource) {
    showError(
      createError({ statusCode: 404, statusMessage: 'Resource not found' }),
    );
  }
});
</script>
```

### Never leave a page in infinite loading state

All data fetches must have error handling. If a fetch fails, show an error state — not a spinner forever.

```vue
<!-- DO: error state shown -->
<div v-if="error" data-testid="error-state">
  Something went wrong.
</div>
<div v-else-if="pending" data-testid="loading">
  <Loader />
</div>
<div v-else>
  {{ data }}
</div>

<!-- DON'T: loading forever on error -->
<div v-if="isLoading">
  <Loader />
</div>
<div v-else>
  {{ data }}
</div>
```

## SSR-Safe Redirects

### Cookie-based validation before render

When a page requires a cookie/session to be present (e.g., checkout requires a cart), validate with `useCookie` in setup — it works on both SSR and client:

```vue
<script setup>
const cartId = useCookie('cart_id');
if (!cartId.value) {
  await navigateTo('/cart', { replace: true });
}
</script>
```

### Auth validation

Use Nuxt route middleware for auth checks. The `auth` middleware runs on both SSR and client navigation:

```vue
<script setup>
definePageMeta({ middleware: 'auth' });
</script>
```

## Client-Only Content

### Use `<ClientOnly>` sparingly

Only use `<ClientOnly>` for content that genuinely cannot render on the server:

- Components that access `window`, `document`, or `localStorage`
- Third-party widgets that require a DOM
- Content that intentionally differs between SSR and client (e.g., user-specific personalization that isn't available on SSR)

### Guard browser APIs

```typescript
// DO: guard with import.meta.client
if (import.meta.client) {
  const saved = localStorage.getItem('preference');
}

// DON'T: access browser APIs unconditionally in setup
const saved = localStorage.getItem('preference'); // crashes on SSR
```

## Reference Implementation

The canonical example of correct SSR page behavior is `app/pages/[...slug].vue`:

- Uses `await useRouteResolution()` for SSR-safe data fetching
- Handles 404 with `createError` on server, `showError` on client
- Shows loading skeleton during pending state
- Shows error state with action button on failure

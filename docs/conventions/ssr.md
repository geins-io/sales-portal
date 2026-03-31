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

## Locale / i18n

### Architecture

Locale resolution is a 3-step server-side pipeline. The order matters.

1. **Nitro Plugin 00** (`server/plugins/00.locale-market.ts`) — parses the URL, sets locale/market cookies, and redirects `/` to the default locale path. Stores raw `{ market, locale }` in `event.context.localeMarket`. Fallback locale comes from `process.env.GEINS_LOCALE`, not a hardcoded value.
2. **Nitro Plugin 01** (`server/plugins/01.tenant-context.ts`) — resolves the tenant (needs cookies from plugin 00), validates the locale/market combination against tenant config, stores a validated `ResolvedLocaleMarket` in `event.context.resolvedLocaleMarket`, and redirects if a correction is needed. This is the only layer that may rewrite the locale/market cookies.
3. **Client middleware** (`middleware/locale.ts`) — syncs the Nuxt i18n locale state from the URL on every client-side navigation.

### ResolvedLocaleMarket

Plugin 01 produces a single, validated `ResolvedLocaleMarket` object:

```typescript
interface ResolvedLocaleMarket {
  market: string; // e.g. "SE"
  locale: string; // short code, e.g. "sv"
  localeBcp47: string; // BCP-47, e.g. "sv-SE"
}
```

Server utilities read from `event.context.resolvedLocaleMarket`:

- `getRequestLocale(event)` — returns `resolvedLocaleMarket.locale` (short code)
- `getRequestMarket(event)` — returns `resolvedLocaleMarket.market`
- `buildCachePrefix(event)` — uses both fields for cache key construction

API routes (e.g. `/api/...`) run outside the plugin 01 request hook, so `resolvedLocaleMarket` may not be set. These routes fall back to reading the locale/market cookies directly.

### Locale codes: short vs. BCP-47

URL segments and cookies use **short codes** (`sv`, `en`). GraphQL requires **BCP-47 tags** (`sv-SE`, `en-GB`). Expansion happens at the API boundary only:

- `resolvedLocaleMarket.localeBcp47` — the preferred BCP-47 source for page requests (already expanded by plugin 01).
- `ensureBcp47Locale()` in `server/utils/_sdk.ts` — safety net for API routes where `resolvedLocaleMarket` is not set. Expands short codes before any GraphQL call.
- `getChannelVariables()` calls `ensureBcp47Locale()` internally — use it whenever building SDK channel variables.

To add a new locale, add it to `SupportedLocale` in `shared/utils/locale-market.ts`. Never add new locales as hardcoded string casts elsewhere.

### i18n config rules

- `detectBrowserLanguage: false` — we handle locale detection ourselves (Nitro plugin + cookie). Enabling this will fight the cookie and overwrite the user's selected locale.
- `defaultLocale: 'sv'` — must match the most common tenant's default to minimise SSR hydration mismatch. Do not change this without checking all tenant configs.
- i18n's role is limited to providing `$t()` translation lookups and reactive locale state. It does not drive routing or cookie management.

### What to do / not do

```typescript
// DO: expand at the API boundary
const locale = ensureBcp47Locale(getRequestLocale(event)); // 'sv-SE'
const variables = getChannelVariables(event); // includes BCP-47 locale

// DON'T: pass short codes to SDK/GraphQL
sdk.products({ locale: 'sv' }); // returns 0 results

// DO: use the SupportedLocale type
import type { SupportedLocale } from '~/shared/utils/locale-market';
const locale: SupportedLocale = 'sv';

// DON'T: cast locale strings
const locale = 'sv' as SupportedLocale; // bypasses the type guard
```

## Locale-Safe Navigation

All route paths in the application must include the locale/market prefix. Never use bare paths.

### Rules

- ALWAYS use `localePath()` from `useLocaleMarket()` when building route paths in Vue components
- In route middleware (where composables are unavailable), build the prefix from cookies:
  ```typescript
  const market = useCookie('market').value || 'se';
  const locale = useCookie('locale').value || 'sv';
  const prefix = `/${market}/${locale}`;
  ```
- NEVER use bare paths like `to="/login"`, `navigateTo('/')`, `router.push('/portal/orders')`

### Patterns

```vue
<!-- DO: use localePath() -->
<NuxtLink :to="localePath('/login')">Login</NuxtLink>
<NuxtLink :to="localePath('/portal/orders')">Orders</NuxtLink>

<!-- DON'T: bare paths lose locale prefix -->
<NuxtLink to="/login">Login</NuxtLink>
<NuxtLink to="/portal/orders">Orders</NuxtLink>
```

```typescript
// DO: in middleware, use cookie-based prefix
const market = useCookie('market').value || 'se';
const locale = useCookie('locale').value || 'sv';
const prefix = `/${market}/${locale}`;
return navigateTo({ path: `${prefix}/login` });

// DON'T: redirect to bare path
return navigateTo({ path: '/login' });
```

```typescript
// DO: in components, use localePath()
const { localePath } = useLocaleMarket();
router.replace(localePath('/login'));

// DON'T: bare path in programmatic navigation
router.replace('/login');
```

### Regression Test

A lint-style unit test (`tests/unit/lint/bare-route-paths.test.ts`) scans `app/` for bare route
patterns and fails if any are found. This prevents regressions.

## Type-Prefixed Routing

URLs use single-letter type prefixes to identify content type without server-side resolution:

| Prefix | Content Type | Page File                       | Example                          |
| ------ | ------------ | ------------------------------- | -------------------------------- |
| `/c/`  | Category PLP | `app/pages/c/[...category].vue` | `/se/sv/c/material/epoxy`        |
| `/p/`  | Product PDP  | `app/pages/p/[...alias].vue`    | `/se/sv/p/material/product-name` |
| `/b/`  | Brand PLP    | `app/pages/b/[...brand].vue`    | `/se/sv/b/atlas-copco`           |
| `/s/`  | Search       | `app/pages/s/[query].vue`       | `/se/sv/s/search+query`          |
| (none) | CMS content  | `app/pages/[...slug].vue`       | `/se/sv/about-us`                |

### Key rules

- **Alias extraction**: use `.pop()` on the catch-all params array to get the entity alias (last segment). Earlier segments are parent paths for breadcrumbs/SEO.
- **Link generation**: Geins API returns `canonicalUrl` without type prefixes. Use `categoryPath()`, `productPath()`, `brandPath()` from `shared/utils/route-helpers.ts` to add the prefix, then wrap with `localePath()`.
- **Menu URLs**: `shared/utils/menu.ts` `stripGeinsPrefix()` maps Geins type indicators (e.g. `/l/` for category) to our prefixes (e.g. `/c/`).
- Constants in `shared/constants/route-paths.ts`.

See [ADR-015](../adr/015-type-prefixed-routing.md) for full context.

## Reference Implementation

The canonical example of correct SSR page behavior is `app/pages/[...slug].vue`:

- Uses `useFetch` for SSR-safe data fetching
- Handles 404 with `createError` on server, `showError` on client
- Shows loading skeleton during pending state
- Shows error state with action button on failure

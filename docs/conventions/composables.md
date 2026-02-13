# Composables Conventions

## When to Create a Composable

**Create composables for:**

- Domain-specific logic (`useTenant`, `useRouteResolution`)
- Reusable business logic used in 3+ places
- Complex state that needs to be shared

**Don't create composables for:**

- Utilities available in VueUse (`useStorage`, `useDebounceFn`, `useMediaQuery`)
- One-off logic that's only used in one place
- Thin wrappers around existing APIs

## Check VueUse First

Before writing any utility composable, check [vueuse.org](https://vueuse.org/).

Common ones we use:

```typescript
import { useDebounceFn, useThrottleFn } from '@vueuse/core';
import { useStorage } from '@vueuse/core';
import { useMediaQuery } from '@vueuse/core';
```

## Composable Structure

```typescript
// app/composables/useSomething.ts

export function useSomething() {
  // Use useFetch for server data
  const { data, pending, error } = useFetch('/api/something', {
    dedupe: 'defer',
  });

  // Computed values
  const processed = computed(() => data.value?.items ?? []);

  // Return reactive refs and methods
  return {
    data,
    pending,
    error,
    processed,
  };
}
```

## Existing Composables

| Composable              | Purpose                  | When to Use                     |
| ----------------------- | ------------------------ | ------------------------------- |
| `useTenant()`           | Tenant config access     | Any tenant-aware component      |
| `useTenantTheme()`      | Theme colors/typography  | Styling that needs theme values |
| `useRouteResolution()`  | Dynamic route resolution | Catch-all route pages           |
| `useErrorTracking()`    | Error reporting          | Error boundaries, try/catch     |
| `useAnalyticsConsent()` | Analytics consent state  | Cookie banner, analytics gating |

## API Data in Composables

Always use `useFetch` with `dedupe: 'defer'`:

```typescript
// Good
const { data } = useFetch<Config>('/api/config', {
  dedupe: 'defer',
  $fetch: useNuxtApp().$api, // Only if retry logic needed
});

// Bad - don't wrap useFetch
function useApi<T>(url: string) {
  return useFetch<T>(url); // Unnecessary abstraction
}
```

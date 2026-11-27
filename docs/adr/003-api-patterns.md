---
title: API patterns - useFetch client-side, $fetch server-side
status: accepted
created: 2026-02-02
updated: 2026-11-27
author: '@3li7alaki'
tags: [api, fetch, nuxt]
---

# ADR-003: API Call Patterns

## Context

Multiple ways to make API calls in Nuxt led to inconsistency:

- `$fetch` - low-level fetch wrapper
- `useFetch` - composable with SSR support
- Custom `useApi` wrapper - thin layer over useFetch
- `createApiClient` - complex retry logic wrapper

Needed to standardize when to use what.

## Decision

### Client-side (components, composables)

Use `useFetch` directly with `dedupe: 'defer'`:

```typescript
const { data, pending, error } = useFetch<Product[]>('/api/products', {
  dedupe: 'defer',
});
```

The `dedupe: 'defer'` option prevents duplicate requests and reuses in-flight requests.

### Server-side (API routes)

Use `$fetch` and always pass `event` to `useRuntimeConfig`:

```typescript
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event); // Always pass event!
  const data = await $fetch(`${config.externalApiUrl}/endpoint`);
  return data;
});
```

### Deleted

- `useApi` composable - unnecessary wrapper, use `useFetch` directly
- `$api` plugin and `createApiClient` - removed 2026-11-27. Nothing called it, and its header
  allowlist left out `cookie`, so it could not authenticate an auth-gated route during SSR. Calls
  to our own `/api/*` routes from outside a page use `internalFetch`
  ([conventions/api-clients.md](../conventions/api-clients.md)).

## Consequences

- Consistent patterns across codebase
- Nuxt's built-in caching and SSR work correctly
- Simpler mental model: `useFetch` for components, `$fetch` for server

---
title: State management - Pinia for client, useFetch for server
status: accepted
created: 2026-02-02
author: '@3li7alaki'
tags: [state, pinia, usefetch]
---

# ADR-002: State Management Strategy

## Context

Needed clarity on when to use Pinia vs Nuxt's data fetching utilities. Common anti-pattern was putting server data into Pinia stores, leading to:

- Manual cache invalidation
- SSR hydration issues
- Duplicated loading/error state management

## Decision

**Pinia** = Client/UI state only

- Sidebar open/closed
- Modal visibility
- User preferences
- Auth state (tokens, user info)

**useFetch / useAsyncData** = Server state

- API responses
- Tenant configuration
- Any data from the server

```typescript
// Pinia - UI state
const appStore = useAppStore();
appStore.sidebarOpen = true;

// useFetch - Server state
const { data, pending } = useFetch('/api/products', { dedupe: 'defer' });
```

## Consequences

- Clear separation of concerns
- Nuxt handles caching, SSR hydration, deduplication automatically
- No TanStack Query needed - `useFetch` with `dedupe: 'defer'` covers most cases
- Pinia stores stay small and focused on UI concerns

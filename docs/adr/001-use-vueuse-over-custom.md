---
title: Use VueUse over custom composables
status: accepted
created: 2026-02-02
author: '@3li7alaki'
tags: [composables, vueuse]
---

# ADR-001: Use VueUse Over Custom Composables

## Context

The codebase had custom implementations of common utilities:

- `useDebounce` / `useDebounceFn` / `useThrottleFn`
- `useLocalStorage` / `useSessionStorage`
- `useMediaQuery` / `useBreakpoints`

These duplicated functionality already available in `@vueuse/core` (which is installed). The custom implementations:

- Had Vue lifecycle warnings when used outside components
- Required maintaining tests for standard functionality
- Added cognitive overhead for new developers

## Decision

Use `@vueuse/core` for all utility composables. Delete custom implementations.

**Use VueUse for:**

- `useDebounceFn`, `useThrottleFn` - function debouncing/throttling
- `useStorage` - localStorage/sessionStorage with SSR support
- `useMediaQuery`, `useBreakpoints` - responsive utilities
- Any other common utility (see [VueUse docs](https://vueuse.org/))

**Only create custom composables for:**

- Domain-specific logic (e.g., `useTenant`, `useRouteResolution`)
- Project-specific patterns not covered by VueUse

## Consequences

- Fewer files to maintain
- Battle-tested implementations with proper SSR handling
- Developers can reference VueUse docs directly
- Must check VueUse before creating any utility composable

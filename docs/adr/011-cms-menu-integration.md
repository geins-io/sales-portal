---
title: CMS Menu Integration
status: accepted
created: 2026-02-23
author: '@alihalaki'
tags: [cms, navigation, menus]
---

# ADR-011: CMS Menu Integration

## Context

The storefront needs dynamic navigation menus that content editors can manage through the Geins CMS Menu Builder. Previously, header, mobile, and footer navigation all used hardcoded placeholder data. We needed to decide how to fetch and share menu data across components, and whether menu location IDs should be configurable per tenant.

## Decision

1. **Convention-based location IDs.** All tenants use the same menu location strings: `main` for header navigation, `footer` for footer links. These are defined as constants in `shared/constants/cms.ts`. Content differs per tenant; location strings are a code convention matching what's configured in the Geins CMS.

2. **Composable over Pinia store.** `useMenuData(locationId)` wraps `useFetch` with `dedupe: 'defer'`. Nuxt automatically deduplicates when multiple components (desktop nav + mobile nav) call with the same location ID. Read-only server data doesn't need a reactive store.

3. **No fallback content.** If a menu location has no items, the component renders nothing. The footer is 100% CMS-driven — all hardcoded columns were removed.

4. **Shared pure-function utilities** in `shared/utils/menu.ts` handle URL normalization (stripping tenant hostname from CMS canonical URLs), item filtering (hidden, sort order), and external link detection. These are framework-agnostic and testable in the node test tier.

## Consequences

**Good:**

- Content editors control all navigation without code changes
- Single source of truth for menu data (CMS)
- Shared utilities prevent URL handling bugs across components
- Adding new menu locations requires only adding a constant and calling `useMenuData`

**Bad:**

- If CMS menu data is empty/misconfigured, navigation disappears entirely (no fallback)
- Menu location IDs are a code convention — if the CMS uses different strings, code must be updated
- URL normalization depends on the CMS storing absolute URLs (current behavior) — if Geins changes this, the utility needs updating

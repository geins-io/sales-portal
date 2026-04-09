# Architecture Decision Records

ADRs document significant architectural decisions with context and consequences.

## Index

| #   | Decision                                                                           | Status   | Date       |
| --- | ---------------------------------------------------------------------------------- | -------- | ---------- |
| 001 | [Use VueUse over custom composables](001-use-vueuse-over-custom.md)                | accepted | 2026-02-02 |
| 002 | [State management: Pinia for client, useFetch for server](002-state-management.md) | accepted | 2026-02-02 |
| 003 | [API patterns: useFetch client-side, $fetch server-side](003-api-patterns.md)      | accepted | 2026-02-02 |
| 004 | [Geins SDK integration via service layer](004-geins-sdk-service-layer.md)          | accepted | 2026-02-03 |
| 005 | [Internationalization with @nuxtjs/i18n](005-internationalization.md)              | accepted | 2026-02-09 |
| 006 | [Cookie utility module](006-cookie-utility-module.md)                              | accepted | 2026-02-10 |
| 007 | [Tenant config schema & service layer](007-tenant-config-schema-service-layer.md)  | accepted | 2026-02-11 |
| 008 | [SEO Foundation with @nuxtjs/seo](008-seo-foundation.md)                           | accepted | 2026-02-12 |
| 009 | [Webhook-based config cache invalidation](009-webhook-cache-invalidation.md)       | accepted | 2026-02-16 |
| 010 | [Navigation performance optimizations](010-navigation-performance.md)              | accepted | 2026-02-16 |
| 011 | [CMS Menu Integration](011-cms-menu-integration.md)                                | accepted | 2026-02-23 |
| 012 | [CMS page layout variants driven by pageArea](012-cms-page-layout-variants.md)     | accepted | 2026-02-26 |
| 013 | [Configurable Checkout Mode (Hosted vs Custom)](013-configurable-checkout-mode.md) | accepted | 2026-03-15 |
| 014 | [CMS Caching Strategy](014-caching-strategy.md)                                    | accepted | 2026-03-20 |
| 015 | [Type-prefixed routing](015-type-prefixed-routing.md)                              | accepted | 2026-03-30 |

## Adding New ADRs

1. Copy `_template.md`
2. Name it `XXX-short-description.md` (next number in sequence)
3. Fill in context, decision, consequences
4. Add to index above
5. Use your GitHub username for author: `"@username"`

## Updating ADRs

If a decision changes, update the existing ADR directly. Delete ADRs that are completely obsolete.

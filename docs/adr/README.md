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

## Adding New ADRs

1. Copy `_template.md`
2. Name it `XXX-short-description.md` (next number in sequence)
3. Fill in context, decision, consequences
4. Add to index above
5. Use your GitHub username for author: `"@username"`

## Updating ADRs

If a decision changes, update the existing ADR directly. Delete ADRs that are completely obsolete.

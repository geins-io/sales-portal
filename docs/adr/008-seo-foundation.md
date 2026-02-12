---
title: SEO Foundation with @nuxtjs/seo
status: accepted
created: 2026-02-12
tags: [seo, schema-org, analytics, multi-tenant]
---

# ADR-008: SEO Foundation

## Context

The sales portal needs a proper SEO foundation so that product-level SEO (JSON-LD Product, Reviews, Breadcrumbs), analytics, and LLM optimization all plug in easily once product data retrieval is built. The tenant config already has an `seo` section with `defaultTitle`, `titleTemplate`, `defaultDescription`, `defaultKeywords`, `robots`, GA/GTM IDs, and verification codes — but only `titleTemplate` was previously wired.

We needed a solution that:

1. Generates dynamic `robots.txt` and `sitemap.xml` per-tenant
2. Sets structured data (Organization, WebSite) from tenant config
3. Loads analytics scripts (GA/GTM) conditionally per-tenant
4. Supports multi-tenant site config (URL, name, locale) at request time
5. Provides a foundation for future product-level SEO

## Decision

### @nuxtjs/seo over manual implementation

We chose `@nuxtjs/seo` (v3.x) — a meta-module that bundles `nuxt-site-config`, `@nuxtjs/sitemap`, `@nuxtjs/robots`, `nuxt-schema-org`, and `nuxt-seo-utils`. This gives us:

- **Dynamic robots.txt** — generated from `nuxt-site-config` indexability, no static file needed
- **Dynamic sitemap.xml** — with API source endpoints for future product/category URL expansion
- **Schema.org** — `useSchemaOrg()` composable with `defineOrganization()`, `defineWebSite()`, and future `defineProduct()`
- **Site config** — per-request override via Nitro `site-config:init` hook

The alternative (manual `<script type="application/ld+json">` injection, custom robots/sitemap routes) would duplicate what the module already handles and miss features like automatic JSON-LD deduplication and canonical URL resolution.

### Multi-tenant site-config via Nitro hook

A Nitro plugin (`server/plugins/03.seo-config.ts`) hooks into `site-config:init` to override the static `nuxt.config.ts` site config with per-tenant values on every request. This sets `url`, `name`, `description`, `defaultLocale`, and `indexable` from the tenant's config.

### Analytics separation via @nuxt/scripts

Analytics (GA/GTM) is handled by `@nuxt/scripts` registry composables (`useScriptGoogleAnalytics`, `useScriptGoogleTagManager`) rather than direct `<script>` injection. This provides privacy-aware loading with consent management hooks and performance optimization via deferred loading. A client-only plugin (`tenant-analytics.ts`) gated by the `NUXT_PUBLIC_FEATURES_ANALYTICS` feature flag loads scripts based on tenant config.

### Schema.org strategy

- **Current:** Organization + WebSite schemas set globally in the `tenant-seo` plugin
- **Future:** Product, BreadcrumbList, Review schemas on product/category pages once data retrieval is built

### llms.txt

A Nitro route (`server/routes/llms.txt.ts`) serves per-tenant `/llms.txt` with store name, description, and contact info. This will be enriched with product categories as data becomes available.

## Consequences

**Positive:**

- All SEO config wired from tenant config — no hardcoded values
- Dynamic lang attribute from tenant locale (was hardcoded `en`)
- Schema.org structured data improves search engine understanding
- Analytics loading respects feature flags and tenant config
- Sitemap and robots.txt are dynamic and multi-tenant aware
- Foundation is ready for product-level SEO without architectural changes

**Negative:**

- `@nuxtjs/seo` adds ~6 sub-modules to the dependency tree
- `ogImage` and `linkChecker` sub-modules disabled but still installed
- Site config hook runs on every request (though tenant data is already KV-cached)

---
outline: deep
---

# Sales Portal Architecture

This document provides a comprehensive overview of the Sales Portal architecture, covering multi-tenant support, theming capabilities, and the overall system design.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Multi-Tenant Architecture](#multi-tenant-architecture)
- [Theming System](#theming-system)
- [API Layer](#api-layer)
- [Configuration](#configuration)
- [Error Handling & Logging](#error-handling--logging)
- [SEO & Analytics](#seo--analytics)
- [Development Guidelines](#development-guidelines)

---

## Overview

The Sales Portal is a multi-tenant storefront application built on Nuxt 4, designed to serve multiple merchants/brands from a single codebase. Each tenant can have their own:

- **Branding** (logos, colors, typography)
- **Theme** (complete visual customization via CSS variables)
- **Configuration** (features, settings, integrations)
- **Content** (via CMS integration)

### Key Features

- **Multi-Tenant Support**: Single deployment serves multiple tenants based on hostname
- **Self-Service Theming**: Tenants can customize appearance without code changes
- **Managed Hosting**: Infrastructure-as-code approach for consistent deployments
- **Type-Safe**: Full TypeScript support throughout the codebase
- **Modern UI**: Built on shadcn-vue + Tailwind CSS 4 design system

---

## Tech Stack

| Technology            | Purpose                                                       |
| --------------------- | ------------------------------------------------------------- |
| **Nuxt 4**            | Vue 3 meta-framework with SSR, routing, and server middleware |
| **Vue 3**             | Reactive UI framework with Composition API                    |
| **Tailwind CSS 4**    | Utility-first CSS framework with design tokens                |
| **shadcn-vue**        | Accessible UI component library (Reka UI based)               |
| **TypeScript**        | Static typing and enhanced developer experience               |
| **Nitro**             | Server engine with multi-platform deployment support          |
| **ESLint + Prettier** | Code quality and formatting                                   |
| **PNPM**              | Fast, disk-efficient package manager                          |

### External Integrations

- **Geins SDK**: E-commerce platform integration (products, orders, customers)
- **Redis/KV Storage**: Tenant configuration persistence (production)
- **File System**: Local storage for development

---

## Project Structure

```
/
├── app/                        # Frontend application code
│   ├── app.vue                 # Root Vue component
│   ├── assets/
│   │   └── css/
│   │       └── tailwind.css    # Tailwind config + design tokens + fallback defaults
│   ├── components/
│   │   ├── layout/             # Header, Footer, Navigation components
│   │   └── ui/                 # shadcn-vue UI primitives
│   ├── composables/
│   │   ├── useTenant.ts        # Tenant data access
│   │   ├── useErrorTracking.ts # Error tracking & reporting
│   │   ├── useFeatureAccess.ts # Feature access control (auth + role gating)
│   │   └── useAnalyticsConsent.ts # Per-tenant analytics consent (GDPR)
│   ├── layouts/
│   │   └── default.vue         # Default page layout
│   ├── lib/
│   │   └── utils.ts            # Utility functions (cn, etc.)
│   ├── pages/                  # File-based routing (type-prefixed)
│   │   ├── c/[...category].vue # Category PLP (/c/...)
│   │   ├── p/[...alias].vue    # Product PDP (/p/...)
│   │   ├── b/[...brand].vue    # Brand PLP (/b/...)
│   │   ├── s/[query].vue       # Search results (/s/...)
│   │   ├── [...slug].vue       # CMS content catch-all
│   │   └── index.vue           # Homepage
│   └── plugins/
│       ├── api.ts              # Custom $api fetch instance
│       ├── auth-init.client.ts # Early auth session check (parallel with tenant)
│       ├── tenant-theme.ts     # Runtime theme injection (CSS, fonts, favicon)
│       ├── tenant-seo.ts       # SEO meta tags, lang attr, schema.org
│       └── tenant-analytics.ts # GA/GTM with consent gating (client-only)
│
├── server/                     # Backend/server code
│   ├── api/
│   │   ├── config.get.ts       # Tenant config endpoint
│   │   └── external/
│   │       └── [...].ts        # Proxy for external APIs
│   ├── middleware/
│   │   ├── cache-headers.ts    # CDN Vary + s-maxage + stale-while-revalidate
│   │   └── csrf-guard.ts       # Rejects non-JSON content types on mutating requests (415)
│   ├── schemas/
│   │   ├── store-settings.ts   # Zod schema + inferred types (ADR-007)
│   │   └── api-input.ts        # Zod schemas for POST route validation
│   ├── services/               # Service layers
│   │   ├── tenant-config.ts    # Tenant config accessor (ADR-007)
│   │   ├── _sdk.ts             # SDK factory (per-tenant singleton cache)
│   │   ├── auth.ts             # CRM auth (login, logout, refresh)
│   │   ├── user.ts             # CRM user (profile, register)
│   │   ├── cms.ts              # CMS (menu, pages, areas)
│   │   ├── cart.ts             # OMS cart operations
│   │   ├── checkout.ts         # OMS checkout + orders
│   │   ├── orders.ts           # OMS order lookup
│   │   ├── products.ts         # Direct GraphQL (no SDK PIM yet)
│   │   ├── product-lists.ts    # Listing, filtering, category/brand pages
│   │   ├── search.ts           # Product search
│   │   ├── brands.ts           # Brand listing
│   │   ├── categories.ts       # Category listing
│   │   ├── channels.ts         # Storefront config
│   │   ├── newsletter.ts       # Newsletter subscribe
│   │   ├── index.ts            # Re-exports all services
│   │   └── graphql/            # .graphql query files + loader
│   │       ├── loader.ts       # Reads .graphql files, resolves fragments
│   │       ├── fragments/      # Shared GraphQL fragments
│   │       ├── products/       # Product queries/mutations
│   │       ├── product-lists/  # Listing + filter queries
│   │       ├── search/         # Search queries
│   │       ├── brands/         # Brand queries
│   │       ├── categories/     # Category queries
│   │       ├── channels/       # Channel queries
│   │       └── newsletter/     # Newsletter mutations
│   ├── plugins/
│   │   ├── 01.tenant-context.ts # Request-level tenant context + tenantId resolution + config caching
│   │   ├── 02.request-logging.ts # Correlation ID, request timing, tenant-scoped logging
│   │   ├── 03.seo-config.ts    # Per-tenant site-config (URL, locale, indexability)
│   │   └── 04.tenant-css.ts    # Tenant CSS + fonts + favicon injection into HTML
│   ├── utils/
│   │   ├── tenant.ts           # Tenant resolution, fetching, hostname mapping, negative cache
│   │   ├── tenant-css.ts       # CSS/theme generation (colors, radius, fonts, override CSS)
│   │   ├── tenant-crud.ts      # Tenant CRUD operations (create, update, delete)
│   │   ├── theme.ts            # OKLCH color derivation
│   │   ├── cookies.ts          # Cookie helpers (auth, tenant, cart, preview, locale)
│   │   ├── errors.ts           # Error codes, createAppError, wrapServiceCall
│   │   ├── sanitize.ts         # CSS/HTML/URL sanitization (tenant CSS, HTML attrs)
│   │   ├── rate-limiter.ts     # Per-endpoint rate limiters (login, register, refresh, error-batch)
│   │   ├── auth.ts             # Auth token validation helpers
│   │   ├── locale.ts           # getRequestLocale, getRequestMarket (cookie-based)
│   │   ├── seo.ts              # SEO utilities (buildSiteUrl, isIndexable)
│   │   ├── feature-access.ts   # Server-side feature gating (canAccessFeatureServer, assertFeatureAccess)
│   │   ├── logger.ts           # Structured logging
│   │   ├── webhook-handler.ts  # Webhook config invalidation (KV + SDK + Nitro cache)
│   │   └── webhook.ts          # Webhook signature verification
│   ├── routes/
│   │   └── llms.txt.ts         # Per-tenant /llms.txt (cached 1h)
│   └── event-context.d.ts      # H3 context type extensions
│
├── shared/                     # Shared code (client + server)
│   ├── constants/
│   │   └── storage.ts          # KV_STORAGE_KEYS, LOCAL_STORAGE_KEYS, COOKIE_NAMES
│   ├── utils/
│   │   └── feature-access.ts   # Evaluator registry (evaluateAccess, canAccessFeature)
│   └── types/
│       ├── index.ts            # Type exports
│       ├── tenant-config.ts    # Tenant configuration types
│       └── layout.ts           # Layout-related types
│
├── mockdata/                   # Mock API responses for development
├── public/                     # Static assets
├── docs/                       # Documentation
│   ├── adr/                    # Architecture Decision Records
│   ├── conventions/            # Coding standards
│   ├── patterns/               # Implementation patterns
│   └── guide/                  # VitePress user guide
│
├── nuxt.config.ts              # Nuxt configuration
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
└── eslint.config.mjs           # ESLint configuration
```

---

## Multi-Tenant Architecture

### How Tenancy Works

The system identifies tenants based on the request hostname. Each tenant is mapped to a configuration that defines their branding, theme, and features.

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ tenant-a.com    │      │ tenant-b.com    │      │ tenant-c.com    │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │    Sales Portal Server    │
                    │                           │
                    │  1. Extract hostname      │
                    │  2. Lookup tenant config  │
                    │  3. Inject into context   │
                    │  4. Serve themed response │
                    └───────────────────────────┘
```

### Request Flow

1. **Hostname Detection** (`server/plugins/01.tenant-context.ts`)
   - Extracts hostname from request (ignoring port)
   - Attaches tenant context to H3 event

2. **Configuration Loading** (`server/api/config.get.ts`)
   - Fetches tenant config from KV storage
   - Auto-creates tenant in development mode
   - Validates tenant is active

3. **Theme Injection** (`app/plugins/tenant-theme.ts`)
   - Applies `data-theme` attribute to HTML
   - Injects custom CSS for tenant

### Tenant Context

The tenant context is available in all server handlers via `event.context.tenant`:

```typescript
// In any server route/middleware
export default defineEventHandler((event) => {
  const { hostname, tenantId, config } = event.context.tenant;
  // hostname: Request hostname (e.g., "tenant-a.localhost")
  // tenantId: Resolved tenant ID (e.g., "tenant-a") — set for page routes, optional for API routes
  // config: Full TenantConfig object (cached per-request, avoids redundant KV lookups)
});
```

Plugin `01.tenant-context.ts` resolves the tenant once per request and stores the full `TenantConfig` in `event.context.tenant.config`. Downstream plugins (03, 04), services, and routes read from context instead of re-resolving.

### Storage Keys

Tenant data uses a 2-step KV lookup model so a tenant with multiple hostnames (primary, aliases) stores its config only once:

- `tenant:id:{hostname}` → tenantId (string) — one entry per hostname
- `tenant:config:{tenantId}` → Full tenant configuration (JSON) — stored once

Lookup: `hostname` → `tenantId` → `TenantConfig`. On cache miss, `resolveTenant()` fetches from the API and writes all hostname mappings + config under the tenantId key.

---

## Theming System

### Design Token Architecture

The theming system uses CSS custom properties (variables) that map to Tailwind CSS 4 design tokens:

```
┌─────────────────────────────────────────────────────────────┐
│                    CSS Custom Properties                     │
│  --primary, --background, --foreground, --border, etc.      │
└─────────────────────────────────────┬───────────────────────┘
                                      │
                    ┌─────────────────▼─────────────────┐
                    │      Tailwind CSS 4 Theme         │
                    │  @theme { --color-primary: ... }  │
                    └─────────────────┬─────────────────┘
                                      │
                    ┌─────────────────▼─────────────────┐
                    │      Component Classes            │
                    │  bg-primary, text-foreground      │
                    └───────────────────────────────────┘
```

### Theme Configuration

Each tenant defines a theme validated by a Zod schema (see [ADR-007](adr/007-tenant-config-schema-service-layer.md)):

```typescript
// From server/schemas/store-settings.ts
interface ThemeConfig {
  name: string; // Theme identifier
  displayName?: string | null; // Human-readable name
  colors: ThemeColors; // 6 required + 26 optional OKLCH colors
  radius?: string | null; // Base border radius (e.g., "0.625rem")
  typography?: ThemeTypography | null;
}
```

The 6 required colors are: `primary`, `primaryForeground`, `secondary`, `secondaryForeground`, `background`, `foreground`. The remaining 26 optional colors (card, muted, accent, destructive, border, input, ring, chart1-5, sidebar\*, etc.) are derived server-side from the 6 core colors when null/omitted.

### Color Derivation

The `deriveThemeColors()` function in `server/utils/theme.ts` fills in all 26 optional colors from the 6 core colors using OKLCH color space manipulation. API-provided non-null values are preserved.

### Dynamic CSS Generation

The `generateTenantCss()` function in `server/utils/tenant-css.ts` creates CSS from derived colors, radius variants, and override CSS:

```typescript
// Input: 6 core OKLCH colors
// Output: CSS with all 32 color variables + base radius
[data-theme='acme'] {
  --primary: oklch(0.47 0.13 195.71);
  --primary-foreground: oklch(0.985 0 0);
  /* ... all 32 colors */
  --radius: 0.625rem;
}
// Radius variants (sm/md/lg/xl) are defined in tailwind.css @theme inline
// via calc(var(--radius) - Npx) — single source of truth.
```

---

## API Layer

### Client-Side API Access

Use `useFetch` with `dedupe: 'defer'` for API calls:

```typescript
// In a component or composable
const { data, pending, error, refresh } = useFetch<ResponseType>(
  '/api/endpoint',
  {
    dedupe: 'defer',
  },
);
```

### Server API Routes

API routes in `server/api/` automatically have access to:

- Tenant context via `event.context.tenant`
- KV storage via `useStorage('kv')`
- Runtime config via `useRuntimeConfig(event)` (always pass the event!)

### Caching

The config endpoint uses Nuxt's `defineCachedEventHandler` with:

- SWR (stale-while-revalidate) enabled
- 1-hour max age
- Host-aware cache keys

### External API Proxy

The `server/api/external/[...].ts` handler proxies requests to external APIs with tenant context. The base URL is configurable via runtime config (`NUXT_EXTERNAL_API_BASE_URL`):

```typescript
// Request: GET /api/external/products
// Proxied to: {externalApiBaseUrl}/{tenantHostname}/products
// Default: https://api.app.com/{tenantHostname}/products
```

---

## Configuration

### Environment Variables

See [`.env.example`](../.env.example) for the full list. Key variables:

| Variable                         | Description                                                | Default                                |
| -------------------------------- | ---------------------------------------------------------- | -------------------------------------- |
| `NUXT_AUTO_CREATE_TENANT`        | Auto-create tenants for unknown hostnames                  | `false`                                |
| `NUXT_GEINS_API_ENDPOINT`        | Geins GraphQL endpoint                                     | `https://merchantapi.geins.io/graphql` |
| `NUXT_GEINS_TENANT_API_URL`      | Geins Tenant API URL (server-only)                         | —                                      |
| `NUXT_STORAGE_DRIVER`            | KV storage driver (`memory`/`fs`/`redis`)                  | `memory`                               |
| `NUXT_STORAGE_REDIS_URL`         | Redis connection URL                                       | —                                      |
| `NUXT_HEALTH_CHECK_SECRET`       | Secret for detailed `/api/health` metrics                  | —                                      |
| `NUXT_WEBHOOK_SECRET`            | Webhook signature verification secret                      | —                                      |
| `NUXT_SENTRY_DSN`                | Sentry DSN (server-only)                                   | —                                      |
| `LOG_LEVEL`                      | Logging verbosity (`debug`/`info`/`warn`/`error`/`silent`) | `info`                                 |
| `NUXT_PUBLIC_FEATURES_ANALYTICS` | Enable analytics scripts                                   | `false`                                |

### Runtime Configuration

Access runtime config in:

**Server-side:**

```typescript
const config = useRuntimeConfig();
console.log(config.geins.apiEndpoint); // Private
console.log(config.public.appName); // Public
```

**Client-side:**

```typescript
const config = useRuntimeConfig();
console.log(config.public.appName); // Only public values
```

---

## Error Handling & Logging

### Error Codes

Standard error codes are defined in `server/utils/errors.ts`:

| Code                 | HTTP Status | Description               |
| -------------------- | ----------- | ------------------------- |
| `TENANT_NOT_FOUND`   | 404         | No tenant for hostname    |
| `TENANT_INACTIVE`    | 403         | Tenant is disabled        |
| `VALIDATION_ERROR`   | 422         | Request validation failed |
| `EXTERNAL_API_ERROR` | 502         | External service failure  |
| `STORAGE_ERROR`      | 500         | KV storage failure        |

### Creating Errors

```typescript
import { createAppError, ErrorCode } from '../utils/errors';

// Simple error
throw createAppError(ErrorCode.NOT_FOUND, 'Product not found');

// With details
throw createAppError(ErrorCode.VALIDATION_ERROR, 'Invalid input', {
  validationErrors: { email: ['Invalid format'] },
});

// Convenience functions
throw createTenantNotFoundError(hostname);
throw createTenantInactiveError(tenantId);
```

### Service Error Handling (`wrapServiceCall`)

All service functions use `wrapServiceCall` for standardized error handling. It catches errors, logs them with context, and re-throws typed application errors:

```typescript
// In a service file
export async function getProducts(event: H3Event) {
  return wrapServiceCall(
    async () => {
      const sdk = await getSdk(event);
      return sdk.products.list();
    },
    'products', // service name for logging
    GeinsError, // known error class to detect
    ErrorCode.BAD_REQUEST, // error code for unknown errors
  );
}
```

See [Patterns: wrapServiceCall](patterns/README.md#wrapservicecall) for details.

### Input Validation

All POST routes use Zod schemas from `server/schemas/api-input.ts` with H3's `readValidatedBody`:

```typescript
import { LoginSchema } from '../../schemas/api-input';

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, LoginSchema.parse);
  // body is typed and validated, invalid input returns 422
});
```

### Logging

Use the structured logger for all server-side logging:

```typescript
import {
  createTenantLogger,
  createRequestLogger,
  logger,
} from '../utils/logger';

// Default logger
logger.info('Application started');
logger.error('Operation failed', error, { context: 'details' });

// Tenant-scoped logger
const log = createTenantLogger(hostname);
log.info('Processing order', { orderId: '123' });

// Request-scoped logger with correlation ID
const requestLog = createRequestLogger(correlationId);
requestLog.info('Processing request', { path: '/api/products' });

// Track custom metrics
logger.trackMetric({
  name: 'order_value',
  value: 99.99,
  unit: 'count',
  dimensions: { currency: 'USD' },
});

// Track external dependencies
logger.trackDependency('Redis', 'cache.redis.io', 15, true);
```

Log levels: `debug` < `info` < `warn` < `error` < `silent` (disables all logging)

### Request Logging

All HTTP requests are automatically logged with:

- **Correlation ID**: Unique identifier for distributed tracing
- **Request timing**: Duration in milliseconds
- **Tenant context**: Tenant ID and hostname
- **Status codes**: HTTP response status

The correlation ID is automatically extracted from incoming headers or generated:

- `X-Correlation-Id`
- `X-Request-Id`
- `traceparent` (W3C Trace Context)

---

## Monitoring & Observability

### Overview

The Sales Portal includes comprehensive monitoring through Azure Application Insights:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Monitoring Stack                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Client     │    │   Server     │    │   Azure      │          │
│  │   Errors     │───▶│   Logger     │───▶│ App Insights │          │
│  └──────────────┘    └──────────────┘    └──────┬───────┘          │
│                                                  │                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────▼───────┐          │
│  │  Health      │    │   Request    │    │ Log Analytics│          │
│  │  Checks      │───▶│   Logging    │───▶│  Workspace   │          │
│  └──────────────┘    └──────────────┘    └──────┬───────┘          │
│                                                  │                   │
│                                           ┌──────▼───────┐          │
│                                           │ Alert Rules  │          │
│                                           │ (Email/SMS)  │          │
│                                           └──────────────┘          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Client-Side Error Tracking

Use the `useErrorTracking` composable for frontend error reporting:

```typescript
// In a component
const { trackError, trackEvent, startTimer } = useErrorTracking();

// Track an error
try {
  await fetchData();
} catch (error) {
  trackError(error, { component: 'ProductList', action: 'fetchData' });
}

// Track a custom event
trackEvent('product_viewed', { productId: '123', category: 'electronics' });

// Measure performance
const timer = startTimer('api_call');
await fetchData();
const duration = timer.stop(); // Logs metric automatically
```

### Error Boundaries

Use `useErrorBoundary` in parent components to catch and report child errors:

```vue
<script setup>
const { error, clearError } = useErrorBoundary({ component: 'ProductSection' });
</script>

<template>
  <div v-if="error" class="error-state">
    <p>Something went wrong</p>
    <button @click="clearError">Try Again</button>
  </div>
  <slot v-else />
</template>
```

### Health Endpoint

The `/api/health` endpoint provides health status with two response levels for security:

#### Public Response (default)

`GET /api/health`

Returns minimal information suitable for load balancers and public monitoring:

```json
{
  "status": "healthy",
  "timestamp": "2026-01-20T10:30:00.000Z"
}
```

#### Detailed Response (requires secret)

`GET /api/health?key=YOUR_SECRET`

When a valid `HEALTH_CHECK_SECRET` is provided, returns comprehensive metrics:

```json
{
  "status": "healthy",
  "timestamp": "2026-01-20T10:30:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "uptime": 86400,
  "checks": {
    "storage": {
      "status": "healthy",
      "latency": 5
    },
    "memory": {
      "status": "healthy",
      "details": {
        "heapUsedMB": 128,
        "heapTotalMB": 256,
        "heapUsedPercent": 50
      }
    }
  }
}
```

Configure the secret via environment variable:

```bash
HEALTH_CHECK_SECRET=your-secret-key
```

#### Status Codes

- `200`: Healthy or degraded (still serving traffic)
- `503`: Unhealthy (should not receive traffic)

### Azure Integration

In Azure environments, logs are automatically sent to Application Insights via:

1. **Structured JSON logging**: Production logs are JSON-formatted for parsing
2. **App Insights SDK**: Auto-configured via environment variables
3. **Correlation IDs**: Distributed tracing across services

Configure via environment variables:

- `APPLICATIONINSIGHTS_CONNECTION_STRING`: Connection string from Azure
- `APPINSIGHTS_INSTRUMENTATIONKEY`: Instrumentation key (legacy)
- `LOG_LEVEL`: Minimum log level (debug, info, warn, error, silent)

---

## Development Guidelines

### Adding New Tenants

1. **Development**: Tenants are auto-created when accessing any hostname
2. **Production**: Add tenant via admin API or database migration

### Creating Components

1. Use shadcn-vue components when available:

   ```bash
   pnpm dlx shadcn-vue add button
   ```

2. Place shared components in `app/components/layout/` or `app/components/ui/`

3. Use design tokens for all colors/spacing:
   ```vue
   <template>
     <div class="bg-background text-foreground border-border">
       <!-- Content -->
     </div>
   </template>
   ```

### Adding Pages

1. Create file in `app/pages/`:

   ```
   app/pages/products/[id].vue → /products/:id
   ```

2. Use the `useTenant` composable for tenant-aware data:
   ```vue
   <script setup>
   const { tenant, hasFeature } = useTenant();
   </script>
   ```

### Testing

```bash
# Unit tests (1219+ tests, Vitest)
pnpm test

# E2E tests (Playwright)
pnpm test:e2e

# Type checking (strict mode)
pnpm typecheck

# Linting
pnpm lint
pnpm lint:fix

# Format
pnpm format
```

### Building for Production

```bash
# Build production bundle
pnpm build

# Preview production build
pnpm preview
```

---

## SEO & Analytics

### SEO Foundation ([ADR-008](adr/008-seo-foundation.md))

The `@nuxtjs/seo` meta-module provides dynamic `robots.txt`, `sitemap.xml`, and `schema.org` structured data. All config is per-tenant:

- **Server plugin** (`server/plugins/03.seo-config.ts`) — overrides `site-config` per-request with tenant URL, name, locale, and indexability
- **Client plugin** (`app/plugins/tenant-seo.ts`) — sets meta tags (`og:locale`, `og:image`, `twitter:card`, verification codes), `lang` attribute, `titleTemplate`, and Organization + WebSite JSON-LD
- **Server utility** (`server/utils/seo.ts`) — `buildSiteUrl()` and `isIndexable()` helpers
- **LLM route** (`server/routes/llms.txt.ts`) — per-tenant `/llms.txt` with 1-hour cache

### Analytics & Consent (GDPR)

Analytics scripts (GA/GTM) load through `@nuxt/scripts` registry composables in `app/plugins/tenant-analytics.ts`. Three gates must pass before scripts fire:

1. **Runtime feature flag** — `NUXT_PUBLIC_FEATURES_ANALYTICS=true`
2. **Tenant feature** — `hasFeature('analytics')` (tenant config)
3. **User consent** — `useAnalyticsConsent().consent.value === true`

The `useAnalyticsConsent()` composable stores consent per-tenant in localStorage (`analytics-consent-{tenantId}`) via VueUse `useStorage`. Default is `false`. The plugin uses `useScriptTriggerConsent({ consent })` to keep scripts dormant until consent is granted.

---

## Feature Access Control

The feature access system provides two levels of checks across client and server:

- **`hasFeature(name)`** — simple "is it enabled?" (checks `.enabled` only). Use in templates for UI visibility.
- **`canAccess(name)` / `canAccessFeatureServer()`** — full evaluation (`.enabled` + `.access` rules: auth, role, group). Use when authorization matters.

### Architecture

```
shared/utils/feature-access.ts    → Pure evaluator registry (strategy pattern)
app/composables/useFeatureAccess.ts → canAccess() — combines useTenant() + useAuthStore()
server/utils/feature-access.ts    → canAccessFeatureServer(), assertFeatureAccess() (throws 403)
app/middleware/feature.ts         → Route guard using canAccess()
```

### Access Rules

| Rule                     | Behavior                                   |
| ------------------------ | ------------------------------------------ |
| `'all'`                  | Everyone                                   |
| `'authenticated'`        | Logged-in users only                       |
| `{ role: 'wholesale' }`  | Matches `user.customerType` from Geins     |
| `{ group: 'staff' }`     | Not yet available in Geins API (safe deny) |
| `{ accountType: 'ent' }` | Not yet available in Geins API (safe deny) |
| _(no access field)_      | Defaults to `'all'`                        |

See [Patterns: Feature Access Control](patterns/README.md#feature-access-control) for implementation examples.

---

## Performance Optimizations

### Navigation Performance

Client-side navigation latency is reduced through three techniques:

1. **Parallel Auth Initialization** (`app/plugins/auth-init.client.ts`)
   - Fires `fetchUser()` during plugin init (fire-and-forget, not awaited)
   - Auth check runs in parallel with `tenant-theme` plugin instead of sequentially in middleware
   - `fetchUser()` uses promise deduplication — concurrent calls share one in-flight request
   - Middleware still calls `fetchUser()` but awaits the already-in-flight promise

2. **Route Resolution Prefetching** (`app/composables/useRouteResolution.ts`)
   - Client-side `Map` cache stores resolved routes for the SPA session
   - `prefetchRouteResolution(path)` pre-warms the cache on link hover/intersection
   - `useRouteResolution()` checks the cache before calling `/api/resolve-route`
   - Server-side LRU cache (5 min TTL, 1000 entries) handles repeated requests

3. **SWR Route Caching** (`nuxt.config.ts` `routeRules`)
   - Static pages (`/`, `/login`, `/portal`, `/portal/login`) cached for 5 minutes
   - Nitro serves stale response immediately, revalidates in background
   - Cache key includes the full URL (host + path) for multi-tenant isolation

### Caching Strategy Overview

| Layer                      | Scope          | TTL       | What                          |
| -------------------------- | -------------- | --------- | ----------------------------- |
| Nitro `routeRules` SWR     | SSR output     | 5 min     | Static page HTML              |
| `defineCachedEventHandler` | Server handler | 1 hour    | Tenant config (`/api/config`) |
| `useAsyncData` payload     | SSR → client   | Hydration | All `useAsyncData` calls      |

---

## Security

### Content Security Policy

The `nuxt-security` module enforces strict CSP with nonce-based script/style loading, SRI, and `strict-dynamic`. See `nuxt.config.ts` `security` block for the full policy.

### CSRF Protection

`server/middleware/csrf-guard.ts` rejects non-JSON content types on mutating API requests (returns 415). Combined with `SameSite=Lax` cookies, this eliminates CSRF without tokens.

### Rate Limiting

Pre-configured rate limiters in `server/utils/rate-limiter.ts`:

- Login: 5 requests/min per IP
- Register: 3 requests/min per IP
- Token refresh: 10 requests/min per IP
- Error batch: 10 requests/min per IP

Rate limiter uses `useStorage('kv')` — scales to Redis in production.

### Tenant CSS Sanitization

`server/utils/sanitize.ts` provides `sanitizeTenantCss()`, `sanitizeHtmlAttr()`, `sanitizeUrl()`, and `escapeCssString()` to prevent injection via tenant-provided content.

---

## Discount & Pricing UI

The storefront renders discount and pricing information from Geins through several layers:

### Data Flow

```
Geins GraphQL API → GraphQL fragments (list-product, product) → SDK types
→ commerce.ts types (DetailProduct, ListProduct) → Vue components
```

Key enriched fields from GraphQL (not in base SDK types):

- `discountType` — `NONE | SALE_PRICE | PRICE_CAMPAIGN | EXTERNAL`
- `discountCampaigns` — `{ name, hideTitle }[]`
- `lowestPrice` — EU omnibus directive lowest price (30-day)

The `DetailProduct` interface in `shared/types/commerce.ts` extends `ProductType` with these enriched fields, replacing incompatible SDK shapes (e.g., `DiscountType` enum vs string, `LowestPriceType` vs `LowestPriceInfo`).

### Components

| Component                 | What it shows                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `PriceDisplay`            | Selling/regular price, discount percentage badge, discount type label (Sale/Campaign/Your Price) |
| `ProductCard`             | Campaign badges overlaid on product image                                                        |
| `ProductDetails`          | Campaign badges, negotiated price banner, PriceDisplay with full context                         |
| `VolumePricingTable`      | Tiered quantity pricing from `CampaignPriceType[]`                                               |
| `CartItem`                | Per-item campaign badges                                                                         |
| `CartDrawer` / `CartPage` | Cart-level discount line, applied campaign names                                                 |

### Shared Patterns

- **Badge styles**: `app/lib/badge-styles.ts` — `BADGE_DESTRUCTIVE` (sales/campaigns) and `BADGE_INFO` (negotiated/external)
- **Campaign filter**: `filterVisibleCampaigns()` in `shared/types/commerce.ts` — filters `hideTitle: true` campaigns
- **Cart discount getters**: `discountAmount` and `visibleCartCampaigns` live in the cart Pinia store to avoid duplication between CartDrawer and CartPage

---

## Future Considerations

- **Admin Dashboard**: Self-service tenant management
- **CDN & Caching**: Edge caching for static assets (see EDGE-TENANT-CONFIG design doc)
- **A/B Testing**: Feature flagging per tenant
- **GraphQL Codegen**: Type-safe query/mutation types (replacing `Promise<unknown>` returns)

---

_Last updated: March 2026_

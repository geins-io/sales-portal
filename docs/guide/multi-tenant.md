# Multi-Tenant Architecture

The Sales Portal is designed to serve multiple tenants (merchants/brands) from a single deployment. This document explains how the multi-tenant system works.

## How Tenancy Works

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

## Request Flow

### 1. Hostname Detection

The server plugin (`server/plugins/02.tenant-context.ts`) extracts the hostname from incoming requests:

- Extracts hostname from request headers
- Ignores port number
- Attaches tenant context to the H3 event

### 2. Tenant Resolution

`resolveTenant()` (`server/utils/tenant.ts`) turns that hostname into a config, trying the
negative cache, then KV storage, then the merchant API — the full order is in
[Architecture](/architecture#request-flow). A cache hit is re-checked against the config's own
hostname list, so a stale alias mapping heals itself. A hostname the merchant API does not know
does not resolve, and the tenant plugin answers 404 — see [Local Development](#local-development).

The resolved config is written to `event.context.tenant.config` once per request. Downstream
plugins, services and routes read it from context instead of resolving again.

### 3. Configuration for the Client

`GET /api/config` (`server/api/config.get.ts`) returns the already-resolved config as
`PublicTenantConfig`, with secrets stripped. It does not resolve tenants itself.

### 4. Theme Injection

The server plugin `server/plugins/04.tenant-css.ts` injects the tenant's visual assets into the
rendered HTML from the `render:html` hook:

- the `data-theme` attribute on `<html>`
- the tenant's CSS as an unlayered `<style>` tag, so it always beats the `@layer base` defaults
- the favicon `<link>`, when `branding.faviconUrl` is set
- Google Fonts preconnect hints and the stylesheet `<link>`

These are raw HTML strings that no client-side code touches during hydration, which is what keeps
the first paint free of a flash of unstyled content.

## Tenant Context

The tenant context is available in all server handlers via `event.context.tenant`:

```typescript
// In any server route/middleware
export default defineEventHandler((event) => {
  const { hostname, tenantId, config } = event.context.tenant;
  // hostname: what the browser asked for, port stripped (e.g. "tenant-a.localhost")
  // tenantId: the resolved tenant's own id (e.g. "tenant-a") — set for page routes,
  //           optional on API routes
  // config:   the full TenantConfig, resolved once per request
});
```

## Storage Keys

A tenant with several hostnames (primary plus aliases) stores its config once, behind a two-step
lookup — `hostname` → `tenantId` → `TenantConfig`:

| Key Pattern                | Purpose                    |
| -------------------------- | -------------------------- |
| `tenant:id:{hostname}`     | Maps hostname to tenant ID |
| `tenant:config:{tenantId}` | Full tenant configuration  |

## Tenant Configuration

The tenant API contract is defined as a Zod schema in `server/schemas/store-settings.ts` (see [ADR-007](/adr/007-tenant-config-schema-service-layer)). All types are inferred from the schema.

The server uses `TenantConfig` (full config including secrets). The client receives `PublicTenantConfig` (secrets stripped):

```typescript
// PublicTenantConfig — what the client receives from GET /api/config
interface PublicTenantConfig {
  tenantId: string;
  hostname: string;
  mode: 'commerce' | 'catalog';
  theme: ThemeConfig;
  branding: BrandingConfig;
  features: Record<string, FeatureConfig>;
  seo?: SeoConfig;
  contact?: ContactConfig;
  css: string;
  isActive: boolean;
  locale: string;
  availableLocales: string[];
}
```

### Branding Configuration

```typescript
interface BrandingConfig {
  name: string;
  watermark: 'full' | 'minimal' | 'none';
  logoUrl?: string | null;
  logoDarkUrl?: string | null;
  logoSymbolUrl?: string | null;
  faviconUrl?: string | null;
  ogImageUrl?: string | null;
}
```

### Features Configuration

Features are a record of feature flags with optional access control:

```typescript
// Feature flag with access control
interface FeatureConfig {
  enabled: boolean;
  access?: 'all' | 'authenticated' | { group: string } | { role: string } | { accountType: string };
}

// Example feature map
features: {
  search: { enabled: true },
  cart: { enabled: true, access: 'authenticated' },
  quotes: { enabled: true, access: { role: 'order_placer' } },
  wishlist: { enabled: false },
}
```

### Tenant Config Service Layer

Server-side code should use the service layer (`server/services/tenant-config.ts`) for structured access:

```typescript
import {
  getTheme,
  getBranding,
  isFeatureEnabled,
  getPublicConfig,
} from '../services/tenant-config';

// Section accessors
const theme = await getTheme(event);
const branding = await getBranding(event);
const enabled = await isFeatureEnabled(event, 'cart');

// Full public config (for API response)
const config = await getPublicConfig(event);
```

## Local Development

Tenant resolution works the same locally as in production: a hostname either exists in the
merchant API or it answers 404. There is no development fallback that invents a tenant for an
unknown name, however you start the server (`pnpm dev`, `pnpm local:dev`, or the Playwright
web server). A 404 on a hostname you expected to work means that exact hostname is not
registered — check the registration before anything else.

Configs come from two places. **The merchant API** is the real one: `resolveTenant()`
calls it over plain `fetch`, from a laptop exactly as from Azure, so any hostname it knows already
works locally given DNS pointing at your machine. **The dev seed**
(`server/plugins/99.dev-tenant-seed.ts`, a no-op outside dev) writes three fixtures at startup —
`tenant-a`, `tenant-b` and `tenant-blank`, each claiming a `.localhost` hostname and the first two
a `.litium.store` alias. `tenant-blank` has no CMS config and exercises the fallback paths.

To browse one, point its hostname at your machine and use the dev server's port:

```
# /etc/hosts
127.0.0.1 tenant-a.localhost tenant-b.localhost tenant-blank.localhost
```

Then `http://tenant-a.localhost:3000`. For a tenant registered in the merchant API, use the
hostname it is registered under: the lookup matches the exact full hostname and does no subdomain
parsing. `pnpm local:setup` installs a dnsmasq wildcard sending all of `*.litium.portal` to
`127.0.0.1`, saving an `/etc/hosts` line per tenant — but only the two legacy test tenants carry a
`.litium.portal` alias in the merchant API, so today any other `name.litium.portal` answers 404. A
dev-only rewrite that looks `name.litium.portal` up as `name.litium.store` is planned, so that any
registered tenant can be browsed locally by name alone.

## Client-Side Usage

Use the `useTenant` composable to access tenant data in components:

```vue
<script setup>
const { tenant, hasFeature, isLoading } = useTenant();
</script>

<template>
  <div v-if="!isLoading">
    <h1>{{ tenant?.branding?.name }}</h1>
    <SearchBar v-if="hasFeature('search')" />
  </div>
</template>
```

## Related Documentation

- [Theming System](/guide/theming) — How to customize tenant appearance
- [API Reference](/guide/api-reference) — Tenant-related API endpoints
- [Architecture Overview](/architecture) — Full system architecture

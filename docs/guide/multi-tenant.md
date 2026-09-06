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
  // hostname: what the browser asked for, port stripped (e.g. "<name>.litium.test")
  // tenantId: the resolved tenant's own id (e.g. "name") — set for page routes,
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

Configs come from one place. `resolveTenant()` calls the merchant API over plain `fetch`, from a
laptop exactly as from Azure, so any hostname it knows already works locally given DNS pointing at
your machine. Nothing in this repository seeds a tenant of its own.

### Browsing a tenant

Open `http://<name>.litium.test:3000`, where `<name>` is the tenant's label under
`.litium.store`.

Nothing has to be configured for that name: the dnsmasq wildcard from `pnpm local:setup` sends
`*.litium.test` to `127.0.0.1` and the server looks the name up under `.litium.store` (see
below) — no `.env` entry, no `/etc/hosts` line. Pointing a run at another tenant is an environment
change, made only through the four `E2E_*` variables (which tenant the e2e suite targets:
[Testing](/testing#e2e-tests)).

The one case that still needs a hosts line is a tenant whose registered hostname is not
`<name>.litium.store`, since that is the only rewrite the wildcard pairs with:

```
# /etc/hosts
127.0.0.1 <the hostname the merchant API knows>
```

The lookup matches the exact full hostname and does no subdomain parsing.

### The `.litium.test` lookup rewrite

`.litium.test` is a local-only convention, and the merchant API knows almost nothing under it,
so the lookup is rewritten: a request for `name.litium.test` is resolved as `name.litium.store`,
where a Geins tenant lives by default (`lookupHostname` in
`server/utils/lookup-hostname.ts`). Any registered tenant is therefore browsable by name alone,
with nothing to configure — and a name the merchant API does not know under either suffix still
answers an honest 404. Only the lookup moves: the response is served under the `.litium.test`
host the browser asked for, and `event.context.tenant.hostname` keeps that name, so cookies,
redirects, the tenant logger and the 404 body all stay on it. The rewritten name surfaces in one
place, the resolution line — the development 404 page shows it, and it is logged — where
`[tenant] resolve host=…` names the `.litium.store` hostname that was actually looked up, not the
one you typed.

**This applies in every mode, the production build included**, because the production build is
what CI and `E2E_PROD=1` test and they need the same name to work with nothing configured on the
machine. Deployed environments are unaffected: RFC 6761 reserves `.test` for testing, so it is
never delegated — a name under it cannot be resolved from the public internet and no deployed
environment can ever receive one. The one thing the rewrite takes away is a tenant that registers
`X.litium.test` as an alias in Geins — it is no longer reachable under that exact name, since the
lookup resolves `X.litium.store` instead, and only local and CI traffic can carry such a name
anyway.

### Environment

No environment variable is required to browse a tenant. `runtimeConfig.geins.tenantApiUrl` in
`nuxt.config.ts` already points at the merchant API's store-settings endpoint, the only call
resolution makes.

The trap is the opposite of a missing variable: **a `NUXT_*` line set to an empty string overrides
the built-in default instead of falling back to it**, because Nitro resolves each key as
`destr(process.env[…]) ?? default` and an empty value is not `undefined`. A line in `.env` either
carries a value or does not exist.

Resolving the config is also what supplies the commerce credentials: `store-settings` returns the
tenant's `geinsSettings` in the same response as its theme and branding, and `createTenantSDK()`
(`server/services/_sdk.ts`) builds the storefront client from them. Nothing to paste in per
tenant.

### When it does not work

In development every lookup logs one line, `[tenant] resolve host=… kv=… api=… outcome=…`, and the
404 page repeats it. The `outcome=` token is what separates the cases below. Failed lookups log at
warn and always show; resolved ones log at debug, which `nuxt dev` prints only with
`CONSOLA_LEVEL=4`. A production build emits neither.

| What you see                                         | `outcome=`          | Cause                                                                                                                                                                                                                                  |
| ---------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 404, "Store not yet available"                       | `unknown-tenant`    | The merchant API does not know the hostname, or knows it and the tenant is switched off — the `api=` field then ends `(inactive)`.                                                                                                     |
| The same 404                                         | `invalid-config`    | The merchant API answered 200 but the payload was unreadable or rejected by the schema — indistinguishable from the row above without the line.                                                                                        |
| A 404 that persists after you fixed the registration | `negative-cache`    | A failed lookup from up to five minutes ago, replayed — the line names what it repeats and its age, `(unknown-tenant, 12s ago)`. Restart the server or wait it out.                                                                    |
| 503, "temporarily unavailable"                       | `transport-failure` | The merchant API gave no answer: connection refused, DNS, timeout, or a non-404 status; never negative-cached, so the next request asks again. The 503 page shows no resolution line — read the server log, and see Environment above. |
| Real branding, no products or prices                 | `resolved`          | The config resolved and the storefront calls failed: the `apiKey`, `accountName`, channel or market on the tenant's record is wrong.                                                                                                   |

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

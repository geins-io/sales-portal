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

The server plugin (`server/plugins/01.tenant-context.ts`) extracts the hostname from incoming requests:

- Extracts hostname from request headers
- Ignores port number
- Attaches tenant context to the H3 event

### 2. Configuration Loading

The config endpoint (`server/api/config.get.ts`) handles tenant configuration:

- Fetches tenant config from KV storage
- Auto-creates tenant in development mode
- Validates tenant is active
- Returns configuration to the client

### 3. Theme Injection

The client plugin (`app/plugins/tenant-theme.ts`) applies tenant-specific theming:

- Applies `data-theme` attribute to HTML element
- Injects custom CSS for the tenant
- Updates theme on configuration changes

## Tenant Context

The tenant context is available in all server handlers via `event.context.tenant`:

```typescript
// In any server route/middleware
export default defineEventHandler((event) => {
  const { id, hostname } = event.context.tenant
  // id: Tenant identifier (e.g., "tenant-a.localhost")
  // hostname: Request hostname
})
```

## Storage Keys

Tenant data is stored with the following key patterns:

| Key Pattern                   | Purpose                       |
| ----------------------------- | ----------------------------- |
| `tenant:id:{hostname}`        | Maps hostname to tenant ID    |
| `tenant:config:{tenantId}`    | Full tenant configuration     |

## Tenant Configuration

Each tenant has a configuration object that defines their settings:

```typescript
interface TenantConfig {
  id: string
  hostname: string
  name: string
  isActive: boolean
  theme: TenantTheme
  branding: TenantBranding
  features: TenantFeatures
  createdAt: string
  updatedAt: string
}
```

### Branding Configuration

```typescript
interface TenantBranding {
  logoUrl?: string
  logoAlt?: string
  faviconUrl?: string
  companyName?: string
}
```

### Features Configuration

```typescript
interface TenantFeatures {
  enableSearch?: boolean
  enableCart?: boolean
  enableWishlist?: boolean
  enableReviews?: boolean
  // ... more feature flags
}
```

## Development Mode

In development mode, tenants are automatically created when accessing any hostname. This makes it easy to test multi-tenant functionality locally:

1. Add entries to your `/etc/hosts` file:
   ```
   127.0.0.1 tenant-a.localhost
   127.0.0.1 tenant-b.localhost
   ```

2. Access the site via the tenant hostname:
   ```
   http://tenant-a.localhost:3000
   http://tenant-b.localhost:3000
   ```

3. Each tenant will be automatically created with default configuration.

## Client-Side Usage

Use the `useTenant` composable to access tenant data in components:

```vue
<script setup>
const { tenant, hasFeature, isLoading } = useTenant()
</script>

<template>
  <div v-if="!isLoading">
    <h1>{{ tenant.name }}</h1>
    <SearchBar v-if="hasFeature('enableSearch')" />
  </div>
</template>
```

## Related Documentation

- [Theming System](/guide/theming) — How to customize tenant appearance
- [API Reference](/guide/api-reference) — Tenant-related API endpoints
- [Architecture Overview](/architecture) — Full system architecture

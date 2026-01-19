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
│   │       ├── tailwind.css    # Tailwind config + design tokens
│   │       └── themes.css      # Static theme overrides (development)
│   ├── components/
│   │   ├── layout/             # Header, Footer, Navigation components
│   │   └── ui/                 # shadcn-vue UI primitives
│   ├── composables/
│   │   ├── useApi.ts           # API fetch wrapper
│   │   └── useTenant.ts        # Tenant data access
│   ├── layouts/
│   │   └── default.vue         # Default page layout
│   ├── lib/
│   │   └── utils.ts            # Utility functions (cn, etc.)
│   ├── pages/                  # File-based routing
│   │   └── index.vue           # Homepage
│   └── plugins/
│       ├── api.ts              # Custom $api fetch instance
│       └── tenant-theme.ts     # Runtime theme injection
│
├── server/                     # Backend/server code
│   ├── api/
│   │   ├── config.get.ts       # Tenant config endpoint
│   │   └── external/
│   │       └── [...].ts        # Proxy for external APIs
│   ├── plugins/
│   │   ├── 00.tenant-init.ts   # Tenant initialization
│   │   └── 01.tenant-context.ts # Request-level tenant context
│   ├── utils/
│   │   ├── tenant.ts           # Tenant CRUD operations
│   │   ├── logger.ts           # Structured logging
│   │   └── errors.ts           # Error handling utilities
│   └── event-context.d.ts      # H3 context type extensions
│
├── shared/                     # Shared code (client + server)
│   └── types/
│       ├── index.ts            # Type exports
│       ├── tenant-config.ts    # Tenant configuration types
│       └── layout.ts           # Layout-related types
│
├── mockdata/                   # Mock API responses for development
├── public/                     # Static assets
├── docs/                       # Documentation
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
  const { id, hostname } = event.context.tenant;
  // id: Tenant identifier (e.g., "tenant-a.localhost")
  // hostname: Request hostname
});
```

### Storage Keys

Tenant data is stored with the following key patterns:

- `tenant:id:{hostname}` → Maps hostname to tenant ID
- `tenant:config:{tenantId}` → Full tenant configuration

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

Each tenant can define a complete theme in their configuration:

```typescript
interface TenantTheme {
  name: string; // Theme identifier
  displayName?: string; // Human-readable name
  colors: ThemeColors; // Light mode colors
  darkColors?: Partial<ThemeColors>; // Dark mode overrides
  typography?: ThemeTypography;
  borderRadius?: ThemeBorderRadius;
  customProperties?: Record<string, string>;
}
```

### Available Color Tokens

| Token               | Purpose                     |
| ------------------- | --------------------------- |
| `primary`           | Primary brand color         |
| `primaryForeground` | Text on primary backgrounds |
| `secondary`         | Secondary brand color       |
| `background`        | Page background             |
| `foreground`        | Default text color          |
| `muted`             | Muted background            |
| `mutedForeground`   | Muted text                  |
| `accent`            | Accent color                |
| `destructive`       | Error/danger states         |
| `border`            | Default border color        |
| `input`             | Input border color          |
| `ring`              | Focus ring color            |
| `card`              | Card backgrounds            |
| `popover`           | Popover backgrounds         |

### Dynamic CSS Generation

The `generateTenantCss()` function in `server/utils/tenant.ts` creates CSS from theme configuration:

```typescript
// Input
const theme = {
  name: 'acme',
  colors: { primary: '#007bff' }
};

// Output
[data-theme='acme'] {
  --primary: #007bff;
}
```

### Dark Mode

Dark mode is supported via:

1. `darkColors` in tenant theme configuration
2. `.dark` class on the HTML element
3. Automatic CSS generation for dark variants

---

## API Layer

### Client-Side API Access

Use the `useApi` composable for type-safe API calls:

```typescript
// In a component or composable
const { data, pending, error, refresh } = useApi<ResponseType>('/api/endpoint');
```

### Server API Routes

API routes in `server/api/` automatically have access to:

- Tenant context via `event.context.tenant`
- KV storage via `useStorage('kv')`
- Runtime config via `useRuntimeConfig()`

### Caching

The config endpoint uses Nuxt's `defineCachedEventHandler` with:

- SWR (stale-while-revalidate) enabled
- 1-hour max age
- Host-aware cache keys

### External API Proxy

The `server/api/external/[...].ts` handler proxies requests to external APIs with tenant context:

```typescript
// Request: GET /api/external/products
// Proxied to: https://api.app.com/{tenantId}/products
```

---

## Configuration

### Environment Variables

See `.env.example` for all available environment variables:

| Variable             | Description            | Default                        |
| -------------------- | ---------------------- | ------------------------------ |
| `NODE_ENV`           | Environment mode       | `development`                  |
| `GEINS_API_ENDPOINT` | Geins GraphQL endpoint | `https://api.geins.io/graphql` |
| `STORAGE_DRIVER`     | KV storage driver      | `fs`                           |
| `REDIS_URL`          | Redis connection URL   | -                              |
| `LOG_LEVEL`          | Logging verbosity      | `info`                         |

> **Note:** `GEINS_API_KEY` is **not** an environment variable. It is configured per-tenant as part of the tenant configuration (`GeinsSettings.apiKey`) when binding a domain. See `shared/types/tenant-config.ts`.

### Runtime Configuration

Access runtime config in:

**Server-side:**

```typescript
const config = useRuntimeConfig();
console.log(config.geins.apiKey); // Private
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

### Logging

Use the structured logger for all server-side logging:

```typescript
import { createTenantLogger, logger } from '../utils/logger';

// Default logger
logger.info('Application started');
logger.error('Operation failed', error, { context: 'details' });

// Tenant-scoped logger
const log = createTenantLogger(tenantId, hostname);
log.info('Processing order', { orderId: '123' });
```

Log levels: `debug` < `info` < `warn` < `error`

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
# Run linting
pnpm lint

# Fix lint issues
pnpm lint:fix

# Format code
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

## Future Considerations

- **Geins SDK Integration**: Full e-commerce functionality
- **Admin Dashboard**: Self-service tenant management
- **Analytics Integration**: Per-tenant analytics tracking
- **CDN & Caching**: Edge caching for static assets
- **A/B Testing**: Feature flagging per tenant

---

_Last updated: January 2026_

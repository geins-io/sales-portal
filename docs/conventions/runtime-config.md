# Runtime Config Conventions

## Overview

Nuxt's runtime config handles environment variables with proper typing and SSR support.

## Configuration

Define in `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  runtimeConfig: {
    // Server-only (private - secrets, API keys)
    apiSecret: '',
    externalApiKey: '',

    // Public (exposed to client)
    public: {
      apiBaseUrl: '/api',
      appName: 'Sales Portal',
    },
  },
});
```

## Environment Variables

Nuxt auto-maps env vars:

| Config Path                       | Environment Variable       |
| --------------------------------- | -------------------------- |
| `runtimeConfig.apiSecret`         | `NUXT_API_SECRET`          |
| `runtimeConfig.public.apiBaseUrl` | `NUXT_PUBLIC_API_BASE_URL` |

## Usage

### Server-side (API routes, plugins)

**Always pass `event`:**

```typescript
export default defineEventHandler(async (event) => {
  // Correct - pass event for proper request context
  const config = useRuntimeConfig(event);

  // Access private values
  const secret = config.apiSecret;

  // Access public values
  const baseUrl = config.public.apiBaseUrl;
});
```

**Why pass event?** In SSR, multiple requests run concurrently. The `event` parameter ensures you get the config scoped to the current request context.

### Client-side (components, composables)

```typescript
const config = useRuntimeConfig();

// Only public values available
const baseUrl = config.public.apiBaseUrl;
```

## Common Mistakes

```typescript
// Bad - missing event in server route
export default defineEventHandler(async () => {
  const config = useRuntimeConfig(); // Wrong!
});

// Bad - accessing private config on client
const secret = useRuntimeConfig().apiSecret; // undefined on client

// Good
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event); // Correct
});
```

## Current Config

See `nuxt.config.ts` for the full runtime config. Key values:

**Server-only (private):**

- `autoCreateTenant` - Auto-create active tenant when API is unavailable (for E2E/dev)
- `externalApiBaseUrl` - External API URL
- `healthCheckSecret` - Secret for detailed health metrics
- `geins.apiEndpoint` - Geins API endpoint
- `geins.tenantApiUrl` - Tenant settings API
- `storage.driver` - Storage driver (memory/redis)
- `storage.redisUrl` - Redis connection URL
- `sentry.dsn` - Sentry error tracking DSN
- `logging.verboseRequests` - Enable verbose request logging (includes headers)

**Public (exposed to client):**

- `public.api.baseUrl` - Internal API base URL
- `public.api.timeout` - Request timeout
- `public.appName` - Application name
- `public.appVersion` - Application version
- `public.environment` - Current environment
- `public.features.analytics` - Analytics feature flag

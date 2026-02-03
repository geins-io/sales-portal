# API Reference

This document describes the server API endpoints available in the Sales Portal.

## Configuration API

### Get Tenant Config

Retrieves the configuration for the current tenant based on the request hostname.

```
GET /api/config
```

**Response:**

```json
{
  "id": "tenant-a.localhost",
  "hostname": "tenant-a.localhost",
  "name": "Tenant A",
  "isActive": true,
  "theme": {
    "name": "tenant-a",
    "colors": {
      "primary": "#007bff"
    }
  },
  "branding": {
    "logoUrl": "/logo.svg",
    "companyName": "Tenant A Inc"
  },
  "features": {
    "enableSearch": true,
    "enableCart": true
  }
}
```

**Caching:**

- SWR (stale-while-revalidate) enabled
- 1-hour max age
- Host-aware cache keys

## Health API

### Health Check

Provides application health status. Supports two response levels for security.

```
GET /api/health
```

**Public Response (default):**

```json
{
  "status": "healthy",
  "timestamp": "2026-01-20T10:30:00.000Z"
}
```

**Detailed Response (with secret):**

```
GET /api/health?key=YOUR_SECRET
```

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

**Status Codes:**

| Code | Meaning                                |
| ---- | -------------------------------------- |
| 200  | Healthy or degraded (still serving)    |
| 503  | Unhealthy (should not receive traffic) |

Configure the secret via environment variable:

```bash
HEALTH_CHECK_SECRET=your-secret-key
```

## External API Proxy

### Proxy External Requests

Proxies requests to external APIs with tenant context.

```
GET /api/external/{path}
```

The proxy:

- Extracts tenant context from the request
- Forwards the request to the configured external API (via `NUXT_EXTERNAL_API_BASE_URL`)
- Includes tenant hostname in the proxied request path

**Example:**

```
GET /api/external/products
→ Proxied to: {externalApiBaseUrl}/{tenantHostname}/products
→ Default: https://api.app.com/{tenantHostname}/products
```

## Error Logging API

### Log Client Errors

Receives client-side errors and logs them server-side.

```
POST /api/log/error
```

**Request Body:**

```json
{
  "message": "Error message",
  "stack": "Error stack trace",
  "context": {
    "component": "ProductList",
    "action": "fetchData"
  }
}
```

## Route Resolution API

### Resolve Route

Resolves a URL path to its corresponding page type and data.

```
GET /api/resolve-route?path=/products/123
```

**Response:**

```json
{
  "type": "product",
  "data": {
    "productId": "123"
  }
}
```

## Client-Side API Usage

### useFetch

Use `useFetch` with `dedupe: 'defer'` for type-safe API calls:

```typescript
const { data, pending, error, refresh } = useFetch<ResponseType>(
  '/api/endpoint',
  {
    dedupe: 'defer',
  },
);
```

**Options:**

```typescript
const { data } = useFetch<ProductList>('/api/products', {
  method: 'GET',
  query: { category: 'electronics' },
  dedupe: 'defer',
  watch: [category], // Re-fetch when reactive value changes
});
```

### $api Plugin

For imperative API calls, use the `$api` plugin:

```typescript
const { $api } = useNuxtApp()

// GET request
const products = await $api('/api/products')

// POST request
const result = await $api('/api/orders', {
  method: 'POST',
  body: { items: [...] }
})
```

## Error Handling

### Standard Error Response

All API errors follow a consistent format:

```json
{
  "statusCode": 404,
  "statusMessage": "Not Found",
  "data": {
    "code": "TENANT_NOT_FOUND",
    "message": "No tenant found for hostname: unknown.com"
  }
}
```

### Error Codes

| Code                 | HTTP Status | Description               |
| -------------------- | ----------- | ------------------------- |
| `TENANT_NOT_FOUND`   | 404         | No tenant for hostname    |
| `TENANT_INACTIVE`    | 403         | Tenant is disabled        |
| `VALIDATION_ERROR`   | 422         | Request validation failed |
| `EXTERNAL_API_ERROR` | 502         | External service failure  |
| `STORAGE_ERROR`      | 500         | KV storage failure        |

## Related Documentation

- [Architecture Overview](/architecture) — Full system architecture
- [Multi-Tenant System](/guide/multi-tenant) — Tenant identification
- [Testing Guide](/testing) — API testing examples

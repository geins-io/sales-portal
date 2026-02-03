# Error Handling Conventions

## Server-side (API Routes)

Use `withErrorHandling` wrapper for consistent error responses:

```typescript
import { withErrorHandling } from '~/server/utils/errors';

export default defineEventHandler(async (event) => {
  return withErrorHandling(
    async () => {
      // Your logic - errors are caught and formatted
      const data = await fetchSomething();
      return data;
    },
    { tenantId: event.context.tenant?.hostname, operation: 'fetchData' },
  );
});
```

### When NOT to use withErrorHandling

Some endpoints have special error handling needs:

| Endpoint Type          | Why                                            | Pattern                           |
| ---------------------- | ---------------------------------------------- | --------------------------------- |
| Health checks          | Must return structured status, not throw       | Return `{ status: 'degraded' }`   |
| Error logging          | Must never fail visibly (prevents retry loops) | Always return `{ success: true }` |
| Rate-limited endpoints | Need to handle 429 before main logic           | Manual try/catch with createError |

### Creating Errors

```typescript
import { createAppError, ErrorCode } from '~/server/utils/errors';

// Standard error
throw createAppError(ErrorCode.NOT_FOUND, 'Product not found');

// With details
throw createAppError(ErrorCode.VALIDATION_ERROR, 'Invalid input', {
  fields: { email: 'Invalid format' },
});

// Convenience functions
throw createTenantNotFoundError(hostname);
throw createTenantInactiveError(tenantId);
```

### Error Codes

| Code                 | HTTP | Use For                  |
| -------------------- | ---- | ------------------------ |
| `NOT_FOUND`          | 404  | Resource doesn't exist   |
| `TENANT_NOT_FOUND`   | 404  | Unknown hostname         |
| `TENANT_INACTIVE`    | 403  | Disabled tenant          |
| `VALIDATION_ERROR`   | 422  | Invalid request data     |
| `EXTERNAL_API_ERROR` | 502  | Upstream service failure |
| `STORAGE_ERROR`      | 500  | Database/KV failure      |

## Client-side (Components)

### Error Boundaries

Use for catching render errors in child components:

```vue
<script setup>
const { error, clearError } = useErrorBoundary({
  component: 'ProductList',
});
</script>

<template>
  <div v-if="error">
    <p>Something went wrong</p>
    <button @click="clearError">Retry</button>
  </div>
  <slot v-else />
</template>
```

### Tracking Errors

```typescript
const { trackError } = useErrorTracking();

try {
  await riskyOperation();
} catch (error) {
  trackError(error, {
    component: 'Checkout',
    action: 'submitOrder',
  });
}
```

### Sentry Context

Sentry context is automatically set up via `app/plugins/error-context.ts`:

- **Tenant context** - Set when tenant loads (id, name as tags)
- **User context** - Set when user logs in/out
- **Breadcrumbs** - Navigation events tracked automatically

No manual setup needed - errors automatically include tenant and user info.

### useFetch Errors

Handle inline:

```vue
<script setup>
const { data, error, refresh } = useFetch('/api/products');
</script>

<template>
  <div v-if="error">
    Failed to load. <button @click="refresh">Retry</button>
  </div>
  <div v-else>{{ data }}</div>
</template>
```

## Logging

### Server-side

```typescript
import { logger, createTenantLogger } from '~/server/utils/logger';

// General logging
logger.info('Operation completed', { orderId: '123' });
logger.error('Operation failed', error, { context: 'details' });

// Tenant-scoped
const log = createTenantLogger(hostname);
log.info('Tenant action', { action: 'checkout' });
```

### Client-side

```typescript
import { logger, createLogger } from '~/utils/logger';

// General logging (debug/info silenced in production)
logger.debug('Fetching data', { id: 123 });
logger.info('User action', { action: 'click' });
logger.warn('Deprecated feature used');
logger.error('Failed to load', { error });

// Component-scoped
const log = createLogger('ProductList');
log.debug('Loading products'); // "[ProductList] Loading products"
```

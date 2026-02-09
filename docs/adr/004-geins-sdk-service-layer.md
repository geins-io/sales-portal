---
title: Geins SDK integration via service abstraction layer
status: accepted
created: 2026-02-03
updated: 2026-02-09
author: '@3li7alaki'
tags: [architecture, sdk, geins, api, services]
---

# ADR-004: Geins SDK Integration via Service Layer

## Context

The Sales Portal needs to integrate with the Geins platform for commerce functionality — auth, users, content, cart, checkout, orders, products, search, and more. The Geins SDK (`@geins/*` v0.6.0) provides stateless domain packages that cover auth, users, CMS, cart, checkout, and orders. For domains not yet covered by dedicated SDK packages, `@geins/core` exposes a GraphQL client that can query the Geins API directly.

We need a pattern that:

1. Uses SDK packages where they exist
2. Uses `@geins/core` GraphQL for everything else
3. Keeps the implementation detail hidden from API routes and components — so the underlying approach can change without affecting consumers

### SDK v0.6.0 Properties

The SDK was designed for server-side use in multi-tenant applications:

- **Stateless services** — no stored tokens or user state. Auth tokens, cart IDs, and user tokens are passed as parameters to every method
- **Thread-safe sharing** — one SDK instance per tenant is safe across concurrent requests because there's no per-request state
- **Typed error hierarchy** — `GeinsError` base with `AuthError`, `CartError`, `CheckoutError`, `NetworkError` subclasses. Each carries a `GeinsErrorCode` enum value
- **Server-only** — we use `Direct` connection mode. The SDK never runs in the browser

## Decision

### 1. Service layer structure

Introduce a `server/services/` layer. Each domain gets a service file that exports typed functions. API routes call services, never the SDK or GraphQL directly.

```
server/services/
├── _sdk.ts             # SDK factory — lazy singleton per tenant
├── index.ts            # Re-exports all services namespaced
│
│   # Services backed by SDK packages
├── auth.ts             # → @geins/crm auth (login, logout, refresh, getUser)
├── user.ts             # → @geins/crm user (profile, register, password reset, orders)
├── cms.ts              # → @geins/cms (menus, pages, content areas)
├── cart.ts             # → @geins/oms cart (CRUD items, promo codes, merchant data)
├── checkout.ts         # → @geins/oms checkout (get, validate, create order, summary)
├── orders.ts           # → @geins/oms orders (order lookup)
│
│   # Services using @geins/core GraphQL directly
├── products.ts         # Product detail, related, reviews
├── product-lists.ts    # Listing, filtering, category/brand pages
├── search.ts           # Product search
├── brands.ts           # Brand listing
├── categories.ts       # Category listing
├── channels.ts         # Storefront channel config
├── newsletter.ts       # Newsletter subscribe
│
└── graphql/            # .graphql query files + loader
    ├── loader.ts       # Reads files, resolves fragment dependencies, caches
    ├── fragments/      # Shared fragments (price, stock, sku, meta, etc.)
    ├── products/       # Product queries/mutations
    ├── product-lists/  # Listing + filter queries
    ├── search/         # Search queries
    ├── brands/         # Brand queries
    ├── categories/     # Category queries
    ├── channels/       # Channel queries
    └── newsletter/     # Newsletter mutations
```

### 2. SDK factory — lazy singleton per tenant

One SDK instance per tenant hostname, created on first request and reused for all subsequent requests. This is safe because SDK v0.6.0 services are stateless — tokens come from httpOnly cookies per request, not from the singleton.

```typescript
// server/services/_sdk.ts
import { GeinsCore } from '@geins/core';
import { GeinsCRM } from '@geins/crm';
import { GeinsCMS } from '@geins/cms';
import { GeinsOMS } from '@geins/oms';
import { AuthClientConnectionModes } from '@geins/types';
import type { H3Event } from 'h3';

interface TenantSDK {
  core: GeinsCore;
  crm: GeinsCRM;
  cms: GeinsCMS;
  oms: GeinsOMS;
}

const tenants = new Map<string, TenantSDK>();

export function getTenantSDK(event: H3Event): TenantSDK {
  const hostname = event.context.tenant.hostname;
  const existing = tenants.get(hostname);
  if (existing) return existing;

  const { geinsSettings } = event.context.tenant;

  const core = new GeinsCore({
    apiKey: geinsSettings.apiKey,
    accountName: geinsSettings.accountName,
    channel: geinsSettings.channel,
    tld: geinsSettings.tld,
    locale: geinsSettings.locale,
    market: geinsSettings.market,
    environment: geinsSettings.environment,
  });

  const crm = new GeinsCRM(core, {
    clientConnectionMode: AuthClientConnectionModes.Direct,
  });

  const cms = new GeinsCMS(core);
  const oms = new GeinsOMS(core);

  const sdk: TenantSDK = { core, crm, cms, oms };
  tenants.set(hostname, sdk);
  return sdk;
}
```

**Why not per-request instances?** SDK v0.6.0 stores no user state on instances. Two concurrent requests for different users share the same `GeinsCRM` safely because tokens are passed as parameters to `crm.auth.login(credentials)`, `crm.user.get(userToken)`, `oms.cart.get({ cartId })`, etc.

**Lifecycle:** Instances live for the Nuxt server process lifetime. On deploy → process restarts → fresh instances. No cleanup needed — no open connections or timers.

### 3. Auth flow — httpOnly cookies

The server manages auth cookies. The SDK handles the Geins auth protocol; we own cookie persistence.

```typescript
// server/services/auth.ts
import type { H3Event } from 'h3';
import type { AuthCredentials, AuthResponse } from '@geins/types';
import { getTenantSDK } from './_sdk';

export async function login(
  credentials: AuthCredentials,
  event: H3Event,
): Promise<AuthResponse> {
  const { crm } = getTenantSDK(event);
  const result = await crm.auth.login(credentials);

  if (!result?.succeeded || !result.tokens?.token) {
    throw createError({ statusCode: 401, message: 'Login failed' });
  }

  return result;
}

export async function refresh(
  refreshToken: string,
  event: H3Event,
): Promise<AuthResponse> {
  const { crm } = getTenantSDK(event);
  const result = await crm.auth.refresh(refreshToken);

  if (!result?.succeeded || !result.tokens?.token) {
    throw createError({ statusCode: 401, message: 'Token refresh failed' });
  }

  return result;
}

export async function getUser(
  refreshToken: string,
  userToken: string,
  event: H3Event,
) {
  const { crm } = getTenantSDK(event);
  return crm.auth.getUser(refreshToken, userToken);
}
```

```typescript
// server/api/auth/login.post.ts
import * as authService from '~~/server/services/auth';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const result = await authService.login(body, event);

  // We own the cookies — SDK never touches them in Direct mode
  setCookie(event, 'auth_token', result.tokens!.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: result.tokens!.expiresIn,
  });

  setCookie(event, 'refresh_token', result.tokens!.refreshToken!, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  // Only return user info — tokens stay server-side
  return {
    user: result.user,
    expiresAt: result.tokens!.expires,
  };
});
```

### 4. Service examples — SDK-backed vs GraphQL

```typescript
// server/services/cart.ts — uses @geins/oms (flat API in v0.6.0)
import type { CartType, CartItemInputType } from '@geins/types';
import { getTenantSDK } from './_sdk';
import type { H3Event } from 'h3';

export async function getCart(
  cartId: string,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  return oms.cart.get(cartId);
}

export async function addItem(
  cartId: string,
  input: CartItemInputType,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  return oms.cart.addItem(cartId, input);
}
```

```typescript
// server/services/products.ts — uses @geins/core GraphQL
import { getTenantSDK } from './_sdk';
import { loadQuery } from './graphql/loader';
import type { H3Event } from 'h3';

export async function getProduct(alias: string, event: H3Event) {
  const { core } = getTenantSDK(event);
  return core.graphql.query({
    queryAsString: loadQuery('products/product.graphql'),
    variables: { alias },
  });
}
```

```typescript
// server/api/products/[alias].get.ts — consumer doesn't know which approach is used
import { getProduct } from '~~/server/services/products';

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias')!;
  return getProduct(alias, event);
});
```

### 5. Error handling

SDK errors are typed and catchable. Services translate them to HTTP errors.

```typescript
import { AuthError, CartError, CheckoutError } from '@geins/core';

// In a service:
try {
  return await oms.cart.addItem(cartId, input);
} catch (error) {
  if (error instanceof CartError) {
    throw createAppError(ErrorCode.BAD_REQUEST, error.message);
  }
  if (error instanceof AuthError) {
    throw createAppError(ErrorCode.UNAUTHORIZED, error.message);
  }
  throw createAppError(ErrorCode.EXTERNAL_API_ERROR, 'Geins API error');
}
```

### 6. SDK API reference (v0.6.0)

Quick reference for the stateless method signatures used in services.

**Auth** (`crm.auth`):
| Method | Signature |
|--------|-----------|
| `login` | `(credentials: AuthCredentials) → Promise<AuthResponse \| undefined>` |
| `logout` | `() → Promise<AuthResponse \| undefined>` |
| `refresh` | `(refreshToken: string) → Promise<AuthResponse \| undefined>` |
| `getUser` | `(refreshToken: string, userToken?: string) → Promise<AuthResponse \| undefined>` |
| `authorized` | `(refreshToken: string) → Promise<boolean>` |

**User** (`crm.user`):
| Method | Signature |
|--------|-----------|
| `get` | `(userToken: string) → Promise<GeinsUserType \| undefined>` |
| `update` | `(user: GeinsUserInputTypeType, userToken: string) → Promise<GeinsUserType \| undefined>` |
| `create` | `(credentials: AuthCredentials, user?: GeinsUserInputTypeType) → Promise<AuthResponse \| undefined>` |
| `remove` | `(userToken: string) → Promise<boolean>` |
| `password.change` | `(credentials: AuthCredentials, refreshToken: string) → Promise<AuthResponse \| undefined>` |
| `password.requestReset` | `(email: string) → Promise<boolean>` |
| `password.commitReset` | `(resetKey: string, password: string) → Promise<boolean>` |
| `orders.get` | `(userToken: string) → Promise<GeinsUserOrdersType \| undefined>` |

**Cart** (`oms.cart`) — flat API in v0.6.0, `cartId` always required:
| Method | Signature |
|--------|-----------|
| `get` | `(cartId: string) → Promise<CartType>` |
| `create` | `() → Promise<CartType>` |
| `addItem` | `(cartId: string, input: CartItemInputType) → Promise<CartType>` |
| `updateItem` | `(cartId: string, input: CartItemInputType) → Promise<CartType>` |
| `deleteItem` | `(cartId: string, itemId: string) → Promise<CartType>` |
| `setPromotionCode` | `(cartId: string, code: string) → Promise<CartType>` |
| `removePromotionCode` | `(cartId: string) → Promise<CartType>` |

**CMS** (`cms.menu`, `cms.page`, `cms.area`):
| Method | Signature |
|--------|-----------|
| `menu.get` | `({ menuLocationId }) → Promise<MenuType \| undefined>` |
| `page.get` | `({ alias }) → Promise<ContentPageType \| undefined>` |
| `area.get` | `({ family, areaName }) → Promise<ContentAreaType \| undefined>` |

### Rules

1. **API routes import from `server/services/` only** — never from `@geins/*` directly
2. **Each service exports typed functions** — the interface is ours, the implementation delegates to SDK packages or `core.graphql`
3. **`_sdk.ts` maintains per-tenant singletons** — each tenant gets its own SDK cached by hostname, reused across requests
4. **Implementation is swappable** — if a service moves from direct GraphQL to an SDK package (or vice versa), only the service file changes
5. **SDK runs server-side only** — no `@geins/*` imports in `app/`. Components and stores call Nuxt API routes via `$fetch`
6. **`event` is always the last parameter** — every service function takes `(args, event: H3Event)` for consistent API and tenant resolution
7. **Tokens come from cookies** — auth tokens are read from httpOnly cookies in API routes and passed to stateless SDK methods. The SDK never manages cookies in Direct mode

### What this replaces

The current `server/api/external/[...].ts` proxy forwards all requests to an external API base URL. As services are built, domain-specific routes will call them instead of proxying. The catch-all proxy remains as a fallback for any endpoints not yet migrated.

## Consequences

- **Clean boundary** — API routes and components never know whether they're talking to an SDK package or direct GraphQL
- **Incremental adoption** — can add new domains or swap implementations one service at a time
- **Testable** — services can be unit tested with mocked SDK clients
- **One place to change** — implementation details are contained in the service file
- **Typed errors** — SDK throws `AuthError`, `CartError`, etc. with error codes, making it straightforward to map to HTTP status codes
- **No per-request overhead** — singleton SDK instances avoid repeated initialization. Only cookie reads are per-request
- **Extra layer** — adds indirection, but the alternative (SDK imports scattered across routes) is harder to maintain and refactor

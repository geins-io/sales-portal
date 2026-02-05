---
title: Geins SDK integration via service abstraction layer
status: accepted
created: 2026-02-03
author: '@3li7alaki'
tags: [architecture, sdk, geins, api, services]
---

# ADR-004: Geins SDK Integration via Service Layer

## Context

The Sales Portal needs to integrate with the Geins platform for commerce functionality — auth, users, content, cart, checkout, orders, products, search, and more. The Geins SDK provides domain packages (`@geins/crm`, `@geins/cms`, `@geins/oms`) that cover some of these. For domains not yet covered by dedicated SDK packages, `@geins/core` exposes a GraphQL client that can query the Geins API directly.

We need a pattern that:

1. Uses SDK packages where they exist
2. Uses `@geins/core` GraphQL for everything else
3. Keeps the implementation detail hidden from API routes and components — so the underlying approach can change without affecting consumers

## Decision

Introduce a `server/services/` layer. Each domain gets a service file that exports typed functions. API routes call services, never the SDK or GraphQL directly.

Services that have a dedicated SDK package delegate to it. Services without one use `core.graphql.query()` with `.graphql` files directly. From the consumer's perspective, there's no difference.

```
server/services/
├── _client.ts          # SDK factory — fresh instance per request, tenant-aware
├── index.ts            # Re-exports all services namespaced
│
│   # Services backed by SDK packages
├── auth.ts             # → @geins/crm auth (login, logout, refresh, getUser)
├── user.ts             # → @geins/crm user (profile, register, password)
├── cms.ts              # → @geins/cms (menus, pages, content areas)
├── cart.ts             # → @geins/oms cart (CRUD items, promo codes)
├── checkout.ts         # → @geins/oms checkout (validate, create order, summary)
├── orders.ts           # → @geins/oms orders (order lookup)
│
│   # Services using @geins/core GraphQL directly
├── products.ts         # Product detail, related, reviews, price history
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

### Rules

1. **API routes import from `server/services/` only** — never from `@geins/*` directly
2. **Each service exports typed functions** — the interface is ours, the implementation delegates to SDK packages or `core.graphql`
3. **`_client.ts` maintains per-tenant singleton clients** — each tenant gets its own `GeinsClient` cached by hostname, reused across requests. Different tenants are fully isolated. The hardened SDK (`NO_CACHE` fetch policy, per-operation auth tokens) makes shared instances safe
4. **Implementation is swappable** — if a service moves from direct GraphQL to an SDK package (or vice versa), only the service file changes. Zero changes to API routes or components
5. **SDK runs server-side only** — no `@geins/*` imports in `app/`. Components and stores call Nuxt API routes via `$fetch`; the server routes call services; services call the SDK
6. **`event` is always the last parameter** — every service function takes `(args, event: H3Event)` for consistent API and tenant resolution

### Example

```typescript
// server/services/products.ts — uses core.graphql directly
import { getGeinsClient } from './_client';
import { loadQuery } from './graphql/loader';

export async function getProduct(args: { alias: string }, event: H3Event) {
  const client = await getGeinsClient(event);
  return client.core.graphql.query({
    queryAsString: loadQuery('products/product.graphql'),
    variables: { alias: args.alias, ...getChannelVariables(client) },
  });
}
```

```typescript
// server/services/cart.ts — uses SDK package
import { getGeinsClient } from './_client';

export async function addItem(
  args: { skuId?: number; quantity?: number },
  event: H3Event,
) {
  const { oms } = await getGeinsClient(event);
  return oms.cart.items.add(args);
}
```

```typescript
// server/api/products/[alias].get.ts — consumer doesn't know which approach is used
import { getProduct } from '~~/server/services/products';

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  return await getProduct({ alias }, event);
});
```

### What this replaces

The current `server/api/external/[...].ts` proxy forwards all requests to an external API base URL. As services are built, domain-specific routes will call them instead of proxying. The catch-all proxy remains as a fallback for any endpoints not yet migrated.

## Consequences

- **Clean boundary** — API routes and components never know whether they're talking to an SDK package or direct GraphQL
- **Incremental adoption** — can add new domains or swap implementations one service at a time
- **Testable** — services can be unit tested with mocked clients, integration tested against the real API
- **One place to change** — implementation details are contained in the service file
- **Extra layer** — adds indirection, but the alternative (SDK/GraphQL imports scattered across routes) is harder to maintain and refactor

---
title: Webhook-based config cache invalidation
status: accepted
created: 2026-02-16
updated: 2026-02-16
tags: [caching, webhooks, security]
---

# ADR-009: Webhook-Based Config Cache Invalidation

## Context

Tenant configuration is cached in two layers:

1. **KV storage** — `tenant:id:<hostname>` and `tenant:config:<tenantId>` entries
2. **Nitro handler cache** — SWR with 1-hour TTL on `/api/config`

When a merchant updates store settings in Geins Studio, stale config can persist for up to an hour. We need a way for Studio to notify us so we can bust the cache immediately.

### Security constraints

- The sales-portal repo is **open source** — secrets in code are visible.
- The merchant API (`merchantapi.geins.io/store-settings`) exposes `geinsSettings.apiKey` without authentication — anyone can obtain a tenant's API key.
- Using the API key as a webhook signing secret would be **forgeable** (visible in code + obtainable from the API).

## Decision

### Signed timestamp (Stripe-style)

The signature header uses the format `t=<unix_seconds>,v1=<hex_hmac>`:

```
x-webhook-signature: t=1700000000,v1=abc123def456...
```

The **signed payload** is `${timestamp}.${rawBody}` — the timestamp comes from the header, not the body. This binds the timestamp to the signature cryptographically, preventing an attacker from replaying a valid signature with a different timestamp.

HMAC is computed as `HMAC-SHA256(signed_payload, shared_secret)` and compared using `crypto.timingSafeEqual`.

### Delivery ID deduplication (`x-webhook-id`)

Each delivery includes a unique `x-webhook-id` header (UUID recommended). The receiver stores processed IDs in KV (`webhook:processed:<id>`) and rejects duplicates with `409 Conflict`. This prevents duplicate processing from retries.

### Body size limit (64 KB)

Requests with `Content-Length` exceeding 64 KB are rejected with `413 Payload Too Large` before reading the body. The actual body size is also checked after reading to catch spoofed `Content-Length` headers.

### Key rotation

`NUXT_WEBHOOK_SECRET` supports comma-separated values: `current_key,old_key`. The receiver tries each key in order and accepts on the first match. This allows zero-downtime secret rotation:

1. Add new key: `NUXT_WEBHOOK_SECRET=new_key,old_key`
2. Update sender to sign with `new_key`
3. Remove old key: `NUXT_WEBHOOK_SECRET=new_key`

### Timestamp replay protection

Requests older than 5 minutes are rejected. This prevents replay attacks with captured valid signatures.

### Dual cache busting

On a valid webhook, we invalidate:

1. KV storage: `tenant:id:<hostname>` and `tenant:config:<tenantId>`
2. Nitro handler cache: `nitro:handlers:tenant:config:<tenantId>`

The next request for that tenant will miss both caches and fetch fresh config from the merchant API.

### Payload contract

```
POST /api/internal/webhook/config-refresh
Headers:
  x-webhook-signature: t=<unix_seconds>,v1=<hex_hmac>
  x-webhook-id: <unique_string>
  content-type: application/json
Body:
  { "hostname": "tenant-a.litium.portal" }
```

- **Signed payload** = `${timestamp}.${rawBody}` — timestamp from header, NOT in body
- **HMAC** = `HMAC-SHA256(signed_payload, shared_secret).hex()`
- **Webhook ID** must be unique per delivery (UUID recommended)
- **Body max** 64 KB

## Consequences

**Positive:**

- Config updates propagate immediately instead of waiting up to 1 hour
- Signing secret is never exposed in code or API responses
- Stripe-style signed timestamp binds the timestamp cryptographically to the payload
- Delivery ID dedup prevents duplicate processing from retries
- Body size limit protects against oversized payloads
- Key rotation enables zero-downtime secret changes
- Rate limiting (10 req/min per IP) protects against abuse
- Handler logic is fully testable without H3 — plain data in, result out

**Negative:**

- Requires coordination with Geins to configure the shared secret
- Single shared secret (not per-tenant) — compromise means all tenants are affected
- In-memory rate limiter doesn't work across multiple instances (acceptable for current single-instance deployment)
- Dedup storage grows over time (consider TTL-based cleanup in future)

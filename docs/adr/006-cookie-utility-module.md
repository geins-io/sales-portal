---
title: Cookie utility module
status: accepted
created: 2026-02-10
tags: [server, cookies, auth, security]
---

# ADR-006: Cookie Utility Module

## Context

Cookie handling was scattered across 8+ server files with duplicated options (`httpOnly`, `secure`, `sameSite`, `path`, `maxAge`) hardcoded in each `setCookie`/`deleteCookie` call. Auth routes (login, register, refresh, logout, me) and `server/utils/auth.ts` all repeated the same cookie configuration. Adding new cookies (tenant ID, cart ID) would mean more duplication.

Risks of the scattered approach:

- Forgetting a security flag in one route (e.g., missing `httpOnly`)
- Inconsistent `maxAge` values across routes
- Cookie name typos causing silent failures
- No single place to audit cookie security settings

## Decision

Create `server/utils/cookies.ts` as the single source of truth for all cookie operations:

- **`COOKIE_NAMES`** constant (shared from `shared/constants/storage.ts`) for cookie name strings
- **`cookieDefaults()`** private function returning shared secure defaults (`httpOnly`, `secure`, `sameSite`, `path`)
- **Typed helpers** for each cookie domain: `setAuthCookies`, `getAuthCookies`, `clearAuthCookies`, `setTenantCookie`, `getTenantCookie`, `setCartCookie`, `getCartCookie`

All existing files that touched cookies were refactored to use these helpers. No file directly calls `setCookie`/`getCookie`/`deleteCookie` with auth or tenant cookie names anymore.

The `COOKIE_NAMES` constant lives in `shared/constants/storage.ts` (alongside `KV_STORAGE_KEYS`) so both server and client code can reference cookie names without importing server-only utilities.

### Cookie inventory

| Cookie          | `httpOnly` | `maxAge`             | Notes                                         |
| --------------- | ---------- | -------------------- | --------------------------------------------- |
| `auth_token`    | yes        | `expiresIn` or 3600s | Short-lived JWT                               |
| `refresh_token` | yes        | 30 days              | Long-lived rotation token                     |
| `tenant_id`     | yes        | 1 day                | Real tenantId (not hostname) for edge workers |
| `cart_id`       | **no**     | 30 days              | Client reads for optimistic UI                |
| `locale`        | —          | —                    | Managed by `@nuxtjs/i18n`                     |
| `market`        | **no**     | 1 year               | Client reads for UI, server reads for GraphQL |
| `preview_mode`  | **no**     | 1 hour               | Client reads for preview banner UI            |

## Consequences

**Good:**

- Single place to change cookie security settings
- Cookie names are constants — typos caught at compile time
- New cookie types are easy to add (define name, write helper, done)
- Auth routes are shorter and focused on business logic
- Tenant context plugin sets a cookie for future edge-worker optimizations

**Bad:**

- One more file to know about (mitigated by Nitro auto-imports — helpers are globally available in server code)
- Slightly more indirection when debugging cookie issues (look at `cookies.ts` instead of inline)

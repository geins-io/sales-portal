---
title: Tenant configuration schema and service layer
status: accepted
created: 2026-02-11
tags: [tenant, zod, schema, service-layer]
---

# ADR-007: Tenant Configuration Schema & Service Layer

## Context

The tenant configuration grew from a simple set of flags to a rich contract with 32 OKLCH color tokens, feature flags with access control, SEO, contact info, and branding. The old approach had several problems:

1. **No runtime validation** — configuration from the external API was trusted at compile time only. A malformed response would cause subtle runtime errors deep in the rendering pipeline.
2. **Flat boolean feature flags** — `TenantFeatures` was `{ enableSearch?: boolean; enableCart?: boolean; ... }`, which couldn't express access control (e.g., "only authenticated users" or "only the staff group").
3. **Scattered field access** — multiple server routes and composables destructured the raw config object, coupling them to its shape. A schema change meant updating many files.
4. **Type duplication** — the server-side config (including API keys) and client-facing config shared one type, risking accidental secret exposure.

## Decision

### Zod schema as single source of truth

All tenant configuration types are derived from a Zod schema in `server/schemas/store-settings.ts`. The schema defines the exact API contract:

- 6 required OKLCH colors + 26 optional (nullable) colors
- Feature flags as `Record<string, { enabled: boolean; access?: FeatureAccess }>`
- `mode: 'commerce' | 'catalog'`
- `watermark: 'full' | 'minimal' | 'none'` on branding
- `overrides` section for per-tenant CSS variable overrides and feature extensions
- Single `radius` string (variants are derived)

TypeScript types are inferred via `z.infer<typeof Schema>`, eliminating manual interface maintenance.

### Server vs. client config split

- `TenantConfig` (server) — full config including `geinsSettings` (transformed from platform shape), `overrides`, `themeHash`, timestamps
- `PublicTenantConfig` (client) — strips secrets, exposes `locale` and `availableLocales` derived from `geinsSettings`

### Service layer

`server/services/tenant-config.ts` provides sectioned accessors:

```typescript
getConfig(event); // Full TenantConfig
getPublicConfig(event); // PublicTenantConfig (for API response)
getTheme(event); // ThemeConfig section
getBranding(event); // BrandingConfig section
getFeatures(event); // Feature record
isFeatureEnabled(event, name); // Boolean check
getMode(event); // 'commerce' | 'catalog'
getSeo(event); // SeoConfig | undefined
getContact(event); // ContactConfig | undefined
```

All accessors call `getTenant()` internally (cached via KV storage + SWR).

### GeinsSettings transformation

The Geins platform auto-injects `geinsSettings` into the store-settings API response in its own shape (`channelId: "2|se"`, `defaultLocale`, `locales[]`, etc.). `transformGeinsSettings()` in `server/utils/tenant.ts` normalizes this to our clean internal shape (`channel`, `tld`, `locale`, `availableLocales[]`, `availableMarkets[]`). Service layer consumers always see the internal shape.

### Feature access evaluation

`FeatureAccess` is defined as a standalone type in `shared/types/tenant-config.ts` (not Zod-inferred) so shared utilities can import it without pulling in server/schema code. The Zod schema still validates the same shape.

A strategy-pattern evaluator registry in `shared/utils/feature-access.ts` evaluates access rules:

- `'all'` → everyone
- `'authenticated'` → logged-in users
- `{ role }` → matches `user.customerType` from Geins
- `{ group }` / `{ accountType }` → safe deny (not yet available in Geins API)

Consumer API:

- **Client:** `useFeatureAccess().canAccess('cart')` — combines `useTenant()` + auth store
- **Server:** `canAccessFeatureServer(event, 'cart', user)` / `assertFeatureAccess(event, 'cart', user)` — reads features from tenant config service
- **Simple check:** `useTenant().hasFeature('cart')` — `.enabled` only, no access rules

Adding a new rule type = adding one evaluator function + extending `UserContext`. Consumer API unchanged.

### Color derivation

`server/utils/theme.ts` provides `deriveThemeColors()` which fills all 26 optional colors from the 6 core colors using OKLCH color-space manipulation. This runs once when building the tenant config and the result is cached.

## Consequences

### Positive

- **Runtime safety** — malformed API responses are caught at parse time with structured error messages
- **Single source of truth** — Zod schema generates all types; no manual interface sync
- **Access control** — features support granular access (group, role, accountType)
- **Decoupled consumers** — components use the service layer, not raw config shape
- **No secret leaks** — `PublicTenantConfig` physically can't contain `geinsSettings` or `overrides`

### Negative

- **Zod dependency** — adds ~30KB to server bundle (acceptable; Zod is already used elsewhere)
- **Extra indirection** — service layer adds one function call between the route and the data. Minimal overhead since config is already cached.
- **Migration cost** — all existing tests and consumers had to update to the new types (one-time cost, done in SAL-9)

### Trade-offs

- We chose Zod v4's two-argument `z.record(z.string(), valueSchema)` syntax. If downgrading to Zod v3, the `z.record()` calls must be adjusted.
- Color derivation uses string-based OKLCH parsing (no external color library). If we need perceptual adjustments later, we may want a proper color library.

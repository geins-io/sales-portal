---
title: Tenant theme color coercion
status: accepted
created: 2026-05-22
tags: [tenant, theme, schema, zod, color]
---

# ADR-016: Tenant theme color coercion

## Context

The tenant config schema introduced in [ADR-007](./007-tenant-config-schema-service-layer.md)
required all theme color tokens to be strict OKLCH strings (e.g. `oklch(0.5 0.1 240)`).
That was correct for the canonical internal shape, but wrong as a parser policy at the
network boundary.

In practice, the Geins merchant admin lets editors pick colors through several different
pickers (depending on screen, browser, and product surface). The resulting `appSettings.theme.colors`
payload contains a mix of formats in the wild:

- 6-digit hex (`#eae8dc`)
- 8-digit hex with alpha (`#eae8dc99`)
- 3-digit hex (`#abc`)
- `rgb(...)` / `rgba(...)`
- `hsl(...)` / `hsla(...)`
- `oklch(...)` with or without alpha
- Named CSS colors (`red`, `transparent`)

The trigger for this work was a tenant whose `topBarBackground` was saved as `#eae8dc99`,
an 8-digit RGBA hex. Strict OKLCH validation rejected the value. The resilient parser
introduced earlier could only substitute whole top-level keys (`theme`, `branding`, etc.),
so a single bad leaf failed the entire `theme` block, the whole tenant config failed to
parse, and the storefront returned a 500.

Two design assumptions had to change:

1. **Color fields are presentation, not contract.** A wrong color in the header is a
   cosmetic defect. A blank tenant is an outage. The schema must never let the second
   happen for the first.
2. **The storefront does not control what the admin emits.** Strict validation at the
   boundary punishes us for the admin's input shape, not the editor's intent.

[ADR-007](./007-tenant-config-schema-service-layer.md) anticipated this in its
Trade-offs section, noting that string-based OKLCH parsing might need a proper color
library "if we need perceptual adjustments later." This is the realisation of that
foreseen need, plus an explicit policy shift.

## Decision

Coerce arbitrary CSS color strings to canonical OKLCH at the schema boundary, and treat
color fields as fully non-fatal in the resilient parser. The result is a three-layer
defense so that no single bad color value can blank a tenant.

### Layer 1: schema-level coercion (`server/utils/color-coercion.ts`)

A `CoercedColorSchema` runs on every color leaf in `server/schemas/store-settings.ts`.
It uses [culori](https://culorijs.org/) to parse the incoming string in any supported
CSS color format and re-emit OKLCH:

- Opaque colors are emitted as `oklch(L C H)`.
- Translucent colors are emitted as `oklch(L C H / A)`. Alpha is preserved verbatim
  because the merchant admin's saved value is the truth.
- Input is capped at 256 characters (defence against pathological input).
- Garbage input fails Zod validation with a truncated raw value (40 chars) in the issue
  message so the salvager can act on it.

Every one of the 40 color keys in the store-settings schema goes through
`CoercedColorSchema.nullable().optional()`.

### Layer 2: leaf-strip salvage (`parseStoreSettingsResilient` in `server/utils/tenant.ts`)

When the schema still fails (because a non-color field is bad, or because a color leaf
contains genuine garbage culori can't parse), the resilient parser runs a three-stage
salvage:

1. **Top-level substitution.** When a top-level field fails (`mode`, `branding`,
   `theme`, etc.), substitute from `SALVAGE_DEFAULTS`. The `theme` substitution lazily
   calls `createDefaultTheme(hostname)` so the salvage palette tracks the canonical
   default and cannot drift.
2. **Leaf strip.** When a nested leaf fails (e.g. `theme.colors.topBarBackground` is
   uncoercible garbage), `deleteAtPath` removes that specific leaf and the parser
   retries. Bounded by `MAX_LEAF_STRIPS = 64` and defended against prototype pollution
   via a `FORBIDDEN_PATH_SEGMENTS` allowlist (`__proto__`, `prototype`, `constructor`).
3. **Core backfill.** After a successful parse, `backfillCoreColors` fills any of the
   six required core OKLCH keys (primary, primaryForeground, secondary, secondaryForeground,
   background, foreground) from `createDefaultTheme(hostname).colors` if undefined.

### Layer 3: fatal-path allowlist

A tenant can still fail to load when something genuinely irrecoverable is wrong. The
`FATAL_PATHS` set is the only set of paths that may take a tenant offline: `tenantId`,
`hostname`, `geinsSettings`, `geinsSettings.apiKey`, `geinsSettings.accountName`. Color
fields are never fatal.

## Consequences

### Positive

- A tenant whose admin contains any combination of bad color values still renders. The
  canonical default palette is the worst-case fallback.
- Coverage is uniform across the 40 color keys, so future additions inherit the policy
  automatically as long as they go through `CoercedColorSchema`.
- The salvager's leaf strip is general-purpose. Future non-fatal leaves elsewhere in the
  schema get the same recovery for free.
- Operators can find tenants emitting non-canonical color formats by grepping
  production logs for resilient-parse warnings on the `theme.colors.*` paths; coercion
  itself is the happy path and no longer emits dedicated warnings.

### Negative

- Validation no longer surfaces color typos loudly at parse time. The trade-off is
  intentional: the editor sees a wrong color in the browser instead of a 500 page, and
  the wrong color is fixable in admin without a code path.
- Derived shades (lighter/darker variants, muted-foreground, ring hues, chart palette)
  are always opaque even when the base they derive from carries alpha. Semantic shade
  math over a translucent base is undefined; we read L/C/H and discard alpha in
  `deriveThemeColors`. A merchant who picks a translucent `primary` gets a translucent
  primary button but opaque derived shades. If a tenant reports a derived surface
  rendered opaque against a translucent base, this is the cause.
- Adds [culori](https://culorijs.org/) as a server dependency (no client impact).

### Trade-offs

- **Preserve alpha on coerced values vs. drop universally.** We chose preserve. The
  merchant admin is the source of truth; dropping alpha overrode the editor's intent
  and rendered translucent topbars opaque. CSS variable consumers can carry the
  4-component OKLCH string into `background-color` directly; the browser handles
  blending.
- **Opaque derivation vs. propagate alpha into derived shades.** We chose opaque. The
  semantics of "20% lighter than a 60%-translucent base" are not well-defined for the
  shadcn-style derivation rules and would multiply alpha through several layers; the
  result would be unusable for accents, borders, and chart hues. Base colors keep
  their alpha; derived shades are solid.
- **Strict OKLCH with fallback vs. full coerce.** We chose full coerce. The failure
  mode of strict validation (whole tenant blank) is worse than the failure mode of
  coerce (one wrong color on screen).
- **Single library (culori) vs. hand-written parsers per format.** Single library wins
  on correctness for HSL and named-color edge cases. The cost is one extra dep.

## Related

- [ADR-007 Tenant Configuration Schema & Service Layer](./007-tenant-config-schema-service-layer.md)
- [Pattern: Color coercion](../patterns/color-coercion.md)
- `server/utils/color-coercion.ts`
- `server/utils/tenant.ts`
- `server/schemas/store-settings.ts`
- `tests/fixtures/store-settings/elproman.json` (regression fixture)

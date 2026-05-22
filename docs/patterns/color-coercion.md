# Color Coercion

The storefront receives theme colors from the merchant admin in a wide range of CSS
color formats. The schema boundary coerces them all to canonical OKLCH and the resilient
parser guarantees that no single bad color value can blank a tenant.

See [ADR-016](../adr/016-tenant-color-coercion.md) for the why.

## Three layers

| Layer | Location                         | Responsibility                                                     |
| ----- | -------------------------------- | ------------------------------------------------------------------ |
| 1     | `server/utils/color-coercion.ts` | Parse any CSS color string, emit OKLCH, preserve alpha verbatim    |
| 2     | `server/utils/tenant.ts`         | Salvage on parse failure: top-level sub, leaf strip, core backfill |
| 3     | `server/utils/tenant.ts`         | `FATAL_PATHS` allowlist: colors are never fatal                    |

Every color leaf in `server/schemas/store-settings.ts` is declared as
`CoercedColorSchema.nullable().optional()`. The pipeline is uniform across all 40 keys.

## Supported input formats

`CoercedColorSchema` accepts the following CSS color strings via culori. All are
re-emitted as OKLCH: opaque colors emit `oklch(L C H)`, translucent colors emit
`oklch(L C H / A)`.

| Input format       | Example         | Notes                                                |
| ------------------ | --------------- | ---------------------------------------------------- |
| 6-digit hex        | `#eae8dc`       | Most common admin output. Opaque.                    |
| 8-digit hex (RGBA) | `#eae8dc99`     | Alpha preserved (admin value is truth).              |
| 3-digit hex        | `#abc`          | Expanded by culori. Opaque.                          |
| `rgb()` / `rgba()` | `rgb(234,232)`  | Alpha preserved when present.                        |
| `hsl()` / `hsla()` | `hsl(0 0% 50%)` | Alpha preserved when present.                        |
| `oklch()`          | `oklch(0.5...)` | Re-emitted in canonical form. Alpha preserved.       |
| Named CSS color    | `red`           | `transparent` emits `oklch(0 0 0 / 0)` (legitimate). |

Anything culori can't parse fails Zod validation with a truncated `raw` value (40 chars).
The salvager then handles the failed leaf in Layer 2.

Input strings longer than 256 characters fail validation outright. The cap is a defence
against pathological payloads, not a stylistic constraint.

## Alpha handling

Coerced values preserve alpha exactly as the admin entered it. The merchant admin's
saved value is the truth; the storefront renders what was saved.

- Opaque colors (no alpha, or alpha === 1) emit the 3-component `oklch(L C H)`.
- Translucent colors emit the 4-component `oklch(L C H / A)`. The alpha component is
  rounded to two decimals for output stability.

There is no alpha-drop warning and no dedup machinery. Coercion is the happy path.

The single place that does discard alpha is `deriveThemeColors` in
`server/utils/theme.ts`. Derived shades (lighter/darker variants, muted foreground,
ring hues, chart palette) are emitted as opaque OKLCH even when their base carries
alpha. Semantic shade math over a translucent base is undefined, so `parseOklch`
reads L/C/H and discards the alpha component before `formatOklch` re-emits a solid
3-component string. Base colors themselves pass through `deriveThemeColors`
unchanged: if the admin sets `primary: rgba(120, 80, 200, 0.8)`, the storefront
renders primary at 80% opacity, but `primaryHover` (derived) is opaque.

## Leaf-strip salvage

When `StoreSettingsSchema.safeParse(raw)` fails, `parseStoreSettingsResilient` in
`server/utils/tenant.ts` runs a bounded recovery loop:

1. **Top-level substitution.** If a top-level field is unsalvageable (`mode`,
   `branding`, `theme`, etc.), substitute from `SALVAGE_DEFAULTS`. The `theme`
   substitution lazily calls `createDefaultTheme(hostname)` so the salvage palette
   tracks the canonical default.
2. **Leaf strip.** If a nested leaf fails (`theme.colors.topBarBackground`), remove
   just that leaf via `deleteAtPath` and re-parse. Bounded by `MAX_LEAF_STRIPS = 64`.
3. **Core backfill.** After a successful parse, fill any of the six required core
   OKLCH keys from `createDefaultTheme(hostname).colors` if undefined: primary,
   primaryForeground, secondary, secondaryForeground, background, foreground.

`deleteAtPath` is hardened against prototype pollution via the
`FORBIDDEN_PATH_SEGMENTS` set (`__proto__`, `prototype`, `constructor`). Paths
containing any of those segments are rejected before traversal.

## Fatal vs. non-fatal

Only paths in `FATAL_PATHS` can take a tenant offline:

- `tenantId`
- `hostname`
- `geinsSettings`
- `geinsSettings.apiKey`
- `geinsSettings.accountName`

Color fields are never fatal. The resilient parser drops, substitutes, or backfills
them as needed.

## Adding a new color key

1. Add the field to `StoreSettingsSchema` in `server/schemas/store-settings.ts` as
   `CoercedColorSchema.nullable().optional()`. Do not introduce a sibling schema; the
   uniform pipeline matters.
2. If the new field is a core color the storefront needs unconditionally, add it to
   `CORE_COLOR_KEYS` in `server/utils/tenant.ts` so `backfillCoreColors` covers it.
3. Add a tenant default to `createDefaultTheme()` if the field has no sensible
   "absent" rendering.
4. No changes to coercion or salvage logic are needed.

## Extending the coercer

If a new CSS color format appears in the wild that culori does not handle, the
extension point is `coerceToOklch` in `server/utils/color-coercion.ts`. The function
is a single pass: input string in, OKLCH string or `null` out. A pre-filter step can
normalise the input before handing it to culori, or a post-filter can rescue specific
patterns. Preserve the alpha-preservation contract; the output format (3-component
vs 4-component) is part of the public contract callers rely on.

If culori is ever swapped for another color library, swap inside `coerceToOklch` only.
The schema and the salvager call `CoercedColorSchema` and `coerceToOklch` respectively
and do not depend on culori's API surface.

## Regression fixture

`tests/fixtures/store-settings/elproman.json` contains a real-world payload that
triggered the original outage (8-digit RGBA hex in `topBarBackground`). The fixture is
parsed by `tests/server/tenant.test.ts` to assert that:

- The fixture parses to a non-null tenant config.
- The core color keys are all populated (either from the input or via backfill).
- The 8-digit RGBA value coerces to a 4-component OKLCH string with the admin's
  alpha preserved.

Three additional scorched-earth tests in the same file assert that every color field
can be set to garbage simultaneously and the tenant still loads.

Add a fixture when a new real-world failure mode is found. Keep fixture filenames
keyed to the tenant identifier in the failing payload.

## Related

- [ADR-016 Tenant theme color coercion](../adr/016-tenant-color-coercion.md)
- [ADR-007 Tenant Configuration Schema & Service Layer](../adr/007-tenant-config-schema-service-layer.md)
- `server/utils/color-coercion.ts`
- `server/utils/tenant.ts`
- `server/schemas/store-settings.ts`
- `tests/fixtures/store-settings/elproman.json`

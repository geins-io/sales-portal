# Theming System

The Sales Portal uses a design token architecture based on CSS custom properties that map to Tailwind CSS 4. This allows tenants to customize their appearance without code changes.

## Design Token Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CSS Custom Properties                     │
│  --primary, --background, --foreground, --border, etc.      │
└─────────────────────────────────┬───────────────────────────┘
                                  │
                    ┌─────────────▼─────────────────┐
                    │      Tailwind CSS 4 Theme     │
                    │  @theme { --color-primary: ... }  │
                    └─────────────┬─────────────────┘
                                  │
                    ┌─────────────▼─────────────────┐
                    │      Component Classes        │
                    │  bg-primary, text-foreground  │
                    └───────────────────────────────┘
```

## Theme Configuration

Each tenant defines a theme validated by a Zod schema (`server/schemas/store-settings.ts`). Types are inferred from the schema:

```typescript
interface ThemeConfig {
  name: string; // Theme identifier
  displayName?: string | null; // Human-readable name
  colors: ThemeColors; // 6 required + 26 optional OKLCH colors
  radius?: string | null; // Base border radius (e.g., "0.625rem")
  typography?: ThemeTypography | null; // Font families
}
```

All colors use OKLCH format (e.g., `oklch(0.47 0.13 195.71)`). Only 6 core colors are required; the remaining 26 are derived automatically server-side when null/omitted.

## Available Color Tokens

### 6 Required Core Colors

| Token                 | Purpose                     | CSS Variable             |
| --------------------- | --------------------------- | ------------------------ |
| `primary`             | Primary brand color         | `--primary`              |
| `primaryForeground`   | Text on primary backgrounds | `--primary-foreground`   |
| `secondary`           | Secondary brand color       | `--secondary`            |
| `secondaryForeground` | Text on secondary           | `--secondary-foreground` |
| `background`          | Page background             | `--background`           |
| `foreground`          | Default text color          | `--foreground`           |

### 26 Optional Colors (derived from core if omitted)

| Token                                   | Derived From    | CSS Variable                                 |
| --------------------------------------- | --------------- | -------------------------------------------- |
| `card` / `cardForeground`               | background / fg | `--card` / `--card-foreground`               |
| `popover` / `popoverForeground`         | background / fg | `--popover` / `--popover-foreground`         |
| `muted` / `mutedForeground`             | dimmed bg / fg  | `--muted` / `--muted-foreground`             |
| `accent` / `accentForeground`           | secondary       | `--accent` / `--accent-foreground`           |
| `destructive` / `destructiveForeground` | red / white     | `--destructive` / `--destructive-foreground` |
| `border`                                | muted variant   | `--border`                                   |
| `input`                                 | border variant  | `--input`                                    |
| `ring`                                  | primary variant | `--ring`                                     |
| `chart1` through `chart5`               | hue rotations   | `--chart-1` through `--chart-5`              |
| `sidebar*` (8 tokens)                   | primary / bg    | `--sidebar-*`                                |

## Using Theme Tokens

### In Templates

Use Tailwind utility classes that reference the design tokens:

```vue
<template>
  <div class="bg-background text-foreground">
    <button class="bg-primary text-primary-foreground hover:bg-primary/90">
      Click me
    </button>
    <p class="text-muted-foreground">Helper text</p>
  </div>
</template>
```

### In CSS

Access CSS variables directly when needed:

```css
.custom-element {
  background-color: var(--primary);
  color: var(--primary-foreground);
  border: 1px solid var(--border);
}
```

## Dynamic CSS Generation

The `generateTenantCss()` function in `server/utils/tenant.ts` creates CSS from derived colors, radius variants, and optional override CSS:

```typescript
// Input: 6 core OKLCH colors from API
// Step 1: deriveThemeColors() fills all 32 colors
// Step 2: generateTenantCss() produces CSS

// Output
[data-theme='acme'] {
  --primary: oklch(0.47 0.13 195.71);
  --primary-foreground: oklch(0.985 0 0);
  /* ... all 32 color variables */
  --radius: 0.625rem;
}
```

Radius variants (`--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`) are defined in `tailwind.css` via `@theme inline` using `calc(var(--radius) - Npx)`, keeping a single source of truth.

## Applying Themes

Themes are applied server-side, by `server/plugins/04.tenant-css.ts`, from Nitro's `render:html`
hook:

1. Reads the tenant config already resolved onto the request context
2. Emits `tenant.css` — generated by `generateTenantCss()` when the config was built — as an
   unlayered `<style>` tag at the top of `<head>`
3. Sets the `data-theme` attribute on `<html>`
4. Adds the favicon and Google Fonts `<link>` tags

Because all four are written into the HTML string before it leaves the server, no client-side code
has to run for the tenant's theme to be correct on first paint.

## Customizing Themes

### Base Theme

The base theme (zinc/neutral fallback) is defined in `app/assets/css/tailwind.css` inside `@layer base`. This is intentional — layered styles have lower cascade priority than unlayered styles, so dynamically injected tenant CSS always wins regardless of source order:

```css
@layer base {
  :root {
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    /* ... all 32 tokens as OKLCH fallback defaults */
  }
}
```

### Tenant Overrides

Tenant-specific CSS is generated by `generateTenantCss()` and injected as an unlayered `<style>` tag in `<head>` by `server/plugins/04.tenant-css.ts`. Because it's unlayered, it always overrides the `@layer base` defaults:

```css
/* Injected dynamically — unlayered, wins over @layer base */
[data-theme='rose'] {
  --primary: oklch(0.637 0.237 25.33);
  --primary-foreground: oklch(0.985 0 0);
  /* ... all 32 derived color variables + radius */
}
```

## Typography

Typography tokens can be customized per tenant. **Values must be Google Fonts family names** (e.g. `"Inter"`, `"DM Sans"`, `"Playfair Display"`). Fonts are loaded via Google Fonts CSS2 API `<link>` tags written into the HTML during SSR by `server/plugins/04.tenant-css.ts` — no flash of unstyled text.

```typescript
interface ThemeTypography {
  fontFamily: string; // Google Fonts name (e.g. "Inter")
  headingFontFamily?: string | null; // Heading font (falls back to fontFamily)
  monoFontFamily?: string | null; // Monospace font
}
```

### Font CSS Custom Properties

The `generateFontCss()` function in `server/utils/tenant.ts` emits font-family CSS variables inside the `[data-theme]` block:

| CSS Variable            | Tailwind Token   | Source                                                    |
| ----------------------- | ---------------- | --------------------------------------------------------- |
| `--font-family`         | `--font-sans`    | `typography.fontFamily`                                   |
| `--heading-font-family` | `--font-heading` | `typography.headingFontFamily` (falls back to fontFamily) |
| `--mono-font-family`    | `--font-mono`    | `typography.monoFontFamily`                               |

Defaults (in `@layer base` of `tailwind.css`):

```css
--font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
--heading-font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
--mono-font-family: ui-monospace, 'SFMono-Regular', monospace;
```

Dynamic tenant CSS (generated per tenant, unlayered — wins over defaults):

```css
[data-theme='rose'] {
  --font-family: 'DM Sans', ui-sans-serif, system-ui, sans-serif;
  --heading-font-family: 'Carter One', ui-sans-serif, system-ui, sans-serif;
  /* ... colors, radius ... */
}
```

### Using Font Tokens

```vue
<template>
  <h1 class="font-heading text-2xl">Heading in tenant heading font</h1>
  <p class="font-sans">Body text in tenant body font</p>
  <code class="font-mono">Monospace code</code>
</template>
```

### Google Fonts Loading

`server/plugins/04.tenant-css.ts` injects the preconnect hints and the Google Fonts stylesheet `<link>` during SSR. The `buildGoogleFontsUrl()` utility (in `shared/utils/fonts.ts`) deduplicates font families and builds a CSS2 API URL with `display=swap`.

## Branding Assets

Two plugins, at two different points, so they are worth keeping apart:

- **Favicon** — `<link rel="icon">` from `branding.faviconUrl`, written into the HTML by
  `server/plugins/04.tenant-css.ts`. The URL is sanitised to `https:` and `data:image/` only.
- **OG image** — `<meta property="og:image">` and `twitter:image` from `branding.ogImageUrl`, set
  through `useHead` by `app/plugins/tenant-seo.ts`.

`useTenant()` exposes both URLs for use in components. Its `faviconUrl` falls back to
`/favicon.ico`; that default is for rendering in components and is separate from what the server
injects.

Access branding URLs via the `useTenant()` composable:

```typescript
const { logoUrl, logoDarkUrl, logoSymbolUrl, faviconUrl, ogImageUrl } =
  useTenant();
```

## Border Radius

The theme accepts a single `radius` string. The dynamic CSS emits only `--radius`; Tailwind handles the variants via `@theme inline` in `tailwind.css`:

```css
/* Dynamic CSS (generated per tenant) */
--radius: 0.625rem;

/* tailwind.css @theme inline (static, single source of truth) */
--radius-sm: calc(var(--radius) - 4px);
--radius-md: calc(var(--radius) - 2px);
--radius-lg: var(--radius);
--radius-xl: calc(var(--radius) + 4px);
```

## Best Practices

1. **Always use design tokens** — Never hardcode colors in components
2. **Test with multiple themes** — Ensure your UI works with different color schemes
3. **Consider accessibility** — Maintain sufficient color contrast ratios
4. **Use semantic tokens** — Choose tokens based on purpose, not visual appearance

## Related Documentation

- [Multi-Tenant Architecture](/guide/multi-tenant) — How tenants are identified
- [Architecture Overview](/architecture) — Full system architecture
- [Getting Started](/guide/getting-started) — Development setup

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
  --radius-sm: calc(0.625rem - 4px);
  --radius-md: calc(0.625rem - 2px);
  --radius-lg: 0.625rem;
  --radius-xl: calc(0.625rem + 4px);
}
```

## Applying Themes

Themes are applied automatically by the `tenant-theme.ts` plugin:

1. Fetches tenant configuration
2. Generates CSS from theme colors
3. Injects `<style>` tag into document head
4. Sets `data-theme` attribute on `<html>` element

## Customizing Themes

### Base Theme

The base theme is defined in `app/assets/css/tailwind.css`:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 224 71% 4%;
    --primary: 220 90% 56%;
    --primary-foreground: 0 0% 100%;
    /* ... more tokens */
  }

  .dark {
    --background: 224 71% 4%;
    --foreground: 0 0% 100%;
    /* ... dark mode overrides */
  }
}
```

### Tenant Overrides

Tenant-specific themes override the base tokens:

```css
[data-theme='tenant-a'] {
  --primary: 142 76% 36%; /* Green */
  --primary-foreground: 0 0% 100%;
}

[data-theme='tenant-b'] {
  --primary: 346 77% 50%; /* Pink */
  --primary-foreground: 0 0% 100%;
}
```

## Typography

Typography tokens can be customized per tenant:

```typescript
interface ThemeTypography {
  fontFamily: string; // Main font family
  headingFontFamily?: string | null; // Heading font (falls back to fontFamily)
  monoFontFamily?: string | null; // Monospace font
}
```

## Border Radius

The theme accepts a single `radius` string. Variants are derived automatically:

```typescript
// In theme config
radius: '0.625rem'

// Generated CSS variables
--radius: 0.625rem;
--radius-sm: calc(0.625rem - 4px);   // Smaller elements
--radius-md: calc(0.625rem - 2px);   // Medium elements
--radius-lg: 0.625rem;               // Large elements (= base)
--radius-xl: calc(0.625rem + 4px);   // Extra large elements
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

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

Each tenant can define a complete theme in their configuration:

```typescript
interface TenantTheme {
  name: string              // Theme identifier
  displayName?: string      // Human-readable name
  colors: ThemeColors       // Theme colors
  typography?: ThemeTypography
  borderRadius?: ThemeBorderRadius
  customProperties?: Record<string, string>
}
```

## Available Color Tokens

| Token               | Purpose                     | CSS Variable           |
| ------------------- | --------------------------- | ---------------------- |
| `primary`           | Primary brand color         | `--primary`            |
| `primaryForeground` | Text on primary backgrounds | `--primary-foreground` |
| `secondary`         | Secondary brand color       | `--secondary`          |
| `background`        | Page background             | `--background`         |
| `foreground`        | Default text color          | `--foreground`         |
| `muted`             | Muted background            | `--muted`              |
| `mutedForeground`   | Muted text                  | `--muted-foreground`   |
| `accent`            | Accent color                | `--accent`             |
| `destructive`       | Error/danger states         | `--destructive`        |
| `border`            | Default border color        | `--border`             |
| `input`             | Input border color          | `--input`              |
| `ring`              | Focus ring color            | `--ring`               |
| `card`              | Card backgrounds            | `--card`               |
| `popover`           | Popover backgrounds         | `--popover`            |

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

The `generateTenantCss()` function in `server/utils/tenant.ts` creates CSS from theme configuration:

```typescript
// Input
const theme = {
  name: 'acme',
  colors: { primary: '#007bff' }
}

// Output CSS
[data-theme='acme'] {
  --primary: #007bff;
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
  --primary: 142 76% 36%;  /* Green */
  --primary-foreground: 0 0% 100%;
}

[data-theme='tenant-b'] {
  --primary: 346 77% 50%;  /* Pink */
  --primary-foreground: 0 0% 100%;
}
```

## Typography

Typography tokens can also be customized per tenant:

```typescript
interface ThemeTypography {
  fontFamily?: string
  fontSize?: {
    base?: string
    sm?: string
    lg?: string
    xl?: string
  }
}
```

## Border Radius

Control the roundedness of UI elements:

```typescript
interface ThemeBorderRadius {
  sm?: string   // Small elements
  md?: string   // Medium elements (default)
  lg?: string   // Large elements, cards
  full?: string // Fully rounded (pills)
}
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

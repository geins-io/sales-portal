## Multitenant Storefront

This repository is a Nuxt 4 starter for building multi-tenant storefront experiences. It wires up a reusable page shell (header, footer, layout slots), shadcn-vue powered UI primitives, and a Tailwind CSS token system that can be themed per tenant without rewriting components.

## Highlights

- Nuxt 4 app shell with a default layout (`app/layouts/default.vue`) that already renders the header, routed page content, and footer.
- Tailwind CSS 4 configuration (`app/assets/css/tailwind.css`) with light/dark design tokens that can be mapped to per-tenant palettes.
- shadcn-vue/Reka UI primitives mounted under `app/components/ui` plus utility helpers like `cn()` for class composition.
- Opinionated folder structure (`app/components/layout`, `shared/types`) that keeps shared building blocks isolated from tenant-specific modules.

## Tech Stack

- Nuxt 4 + Vue 3
- Tailwind CSS 4 with `@nuxtjs/tailwindcss`
- shadcn-vue + Reka UI + Lucide icons
- ESLint + Prettier for formatting and linting
- PNPM for dependency management (see `pnpm-lock.yaml`)

## Getting Started

### Prerequisites

- Node.js 20 or newer (`"engines": { "node": ">=20" }`)
- PNPM 9+ (recommended to match `pnpm-lock.yaml`)

### Installation & Local Development

```bash
pnpm install
pnpm dev
```

Open the dev server URL Nuxt prints (defaults to http://localhost:3000) to preview the storefront shell.

### Common Scripts

| Command             | Description                             |
| ------------------- | --------------------------------------- |
| `pnpm dev`          | Start the Nuxt development server       |
| `pnpm build`        | Build the production bundle             |
| `pnpm generate`     | Pre-render static output (if desired)   |
| `pnpm preview`      | Preview the production build locally    |
| `pnpm lint`         | Run ESLint across the repo              |
| `pnpm lint:fix`     | Auto-fix lint issues where possible     |
| `pnpm format`       | Format supported files with Prettier    |
| `pnpm format:check` | Verify formatting without writing files |

## Project Structure

```
app/
  app.vue                 # Root Nuxt component
  assets/css/tailwind.css # Design tokens + Tailwind layer config
  components/
    layout/               # Header/Footer building blocks
    ui/                   # shadcn-vue components
  layouts/default.vue     # Global layout wrapping every page
  pages/index.vue         # Placeholder storefront landing page
shared/
  types/                  # Cross-tenant TypeScript contracts
public/                   # Static assets (logos, favicons, robots.txt)
docs/                     # Additional documentation (optional)
```

## Theming & UI Guidelines

- Update the CSS variables inside `app/assets/css/tailwind.css` to plug in tenant-specific palettes or radii without changing component code.
- Add new shadcn-vue components via `pnpm dlx shadcn-vue add <component>`; generated files will live under `app/components/ui`.
- Keep shared UX primitives inside `app/components/layout` and `app/components/ui` so that tenant overrides can be layered on top via Nuxt layouts or per-route components.

## API Endpoints

### Health Check

The `/api/health` endpoint provides application health status:

- **Public**: `GET /api/health` — Returns status and timestamp (for load balancers)
- **Detailed**: `GET /api/health?key=YOUR_SECRET` — Returns full metrics including memory, storage, uptime

Set `HEALTH_CHECK_SECRET` environment variable to enable detailed metrics.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for complete API documentation.

## Next Steps

- Flesh out domain-specific pages under `app/pages` (e.g., catalog, product, cart).
- Introduce tenant configuration (domain, theme, content) and hydrate it via Nuxt server routes or runtime config.
- Document any tenant-specific workflows in the `docs/` folder to keep operational knowledge close to the code.

Happy building!

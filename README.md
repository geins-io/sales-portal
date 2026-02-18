## Sales Portal

Multi-tenant storefront application built on Nuxt 4. Serves multiple merchants/brands from a single codebase — each tenant gets their own branding, theme, features, and content via hostname-based routing.

## Tech Stack

- **Nuxt 4** + Vue 3 (SSR, file-based routing)
- **Tailwind CSS 4** with per-tenant CSS variable theming
- **Pinia** for client state, **Geins SDK** for server-side e-commerce
- **shadcn-vue** + Reka UI + Lucide icons
- **Vitest** (875+ unit tests) + **Playwright** (E2E)
- **TypeScript** (strict mode), ESLint + Prettier, PNPM

## Getting Started

### Prerequisites

- Node.js 20+
- PNPM 9+

### Setup

```bash
pnpm install
cp .env.example .env   # Configure environment variables
pnpm dev               # http://localhost:3000
```

In development, tenants are auto-created for any hostname when `NUXT_AUTO_CREATE_TENANT=true`.

### Scripts

| Command          | Description                        |
| ---------------- | ---------------------------------- |
| `pnpm dev`       | Start dev server                   |
| `pnpm build`     | Build production bundle            |
| `pnpm preview`   | Preview production build locally   |
| `pnpm test`      | Run unit tests (Vitest)            |
| `pnpm test:e2e`  | Run E2E tests (Playwright)         |
| `pnpm typecheck` | Run `nuxt typecheck` (strict mode) |
| `pnpm lint`      | Run ESLint                         |
| `pnpm lint:fix`  | Auto-fix lint issues               |
| `pnpm format`    | Format with Prettier               |

## Project Structure

```
app/
  assets/css/tailwind.css   # Tailwind config + design tokens + fallback defaults
  components/
    layout/                 # Header, Footer, Navigation
    shared/                 # Logo, ErrorBoundary, CookieBanner, Switchers
    ui/                     # shadcn-vue primitives
  composables/              # useTenant, useFeatureAccess, useErrorTracking, etc.
  layouts/default.vue       # Default layout with error boundaries
  pages/                    # File-based routing
  plugins/                  # tenant-theme, tenant-seo, tenant-analytics, auth-init, api
  stores/                   # Pinia stores (auth, ui)

server/
  api/                      # API routes (auth, config, products, cart, etc.)
  middleware/                # CSRF guard, CDN cache headers
  plugins/                  # Tenant context, request logging, SEO config, CSS injection
  schemas/                  # Zod validation schemas (store-settings, API input)
  services/                 # Service layer (auth, cart, checkout, CMS, products, etc.)
    graphql/                # .graphql query files + fragment loader
  utils/                    # Tenant resolution, errors, cookies, logger, auth, sanitize, etc.

shared/
  constants/                # Cookie names, KV keys, localStorage keys
  types/                    # Cross-boundary TypeScript types
  utils/                    # Feature access evaluator (pure functions)

docs/
  adr/                      # Architecture Decision Records
  conventions/              # Coding standards
  patterns/                 # Implementation patterns (wrapServiceCall, feature access, etc.)
```

## Architecture

See [docs/architecture.md](docs/architecture.md) for detailed documentation covering:

- Multi-tenant request flow (hostname detection, config loading, theme injection)
- Theming system (CSS custom properties, OKLCH color derivation, per-tenant fonts)
- Service layer with standardized error handling (`wrapServiceCall`)
- SEO & analytics with GDPR consent gating
- Feature access control (role-based, auth-gated)
- Security hardening (CSP, CSRF, input validation, tenant CSS sanitization)
- Monitoring & observability (structured logging, health checks, Sentry)

## Environment Variables

See [`.env.example`](.env.example) for all available configuration. Key variables:

| Variable                    | Description                        | Default    |
| --------------------------- | ---------------------------------- | ---------- |
| `NUXT_AUTO_CREATE_TENANT`   | Auto-create tenants in dev         | `false`    |
| `NUXT_GEINS_API_ENDPOINT`   | Geins GraphQL endpoint             | (see file) |
| `NUXT_GEINS_TENANT_API_URL` | Geins Tenant API URL               | (see file) |
| `NUXT_STORAGE_DRIVER`       | KV storage (`memory`/`fs`/`redis`) | `memory`   |
| `NUXT_HEALTH_CHECK_SECRET`  | Secret for detailed `/api/health`  | —          |
| `LOG_LEVEL`                 | Logging verbosity                  | `info`     |

## Health Check

- `GET /api/health` — Basic status (for load balancers)
- `GET /api/health?key=SECRET` — Detailed metrics (memory, storage, uptime)

# Getting Started

This guide will help you set up the Sales Portal development environment and get you running quickly.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20 or newer** — Required for running the development server
- **PNPM 9+** — Package manager (recommended to match `pnpm-lock.yaml`)

::: tip
You can check your Node.js version with `node --version` and install PNPM with `npm install -g pnpm`.
:::

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/litium/sales-portal.git
cd sales-portal
```

### 2. Install Dependencies

```bash
pnpm install
```

This will install all project dependencies and run the `postinstall` hook which prepares the Nuxt environment.

### 3. Start Development Server

```bash
pnpm dev
```

Open the dev server URL Nuxt prints (defaults to `http://localhost:3000`) to preview the storefront shell.

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
docs/                     # Documentation (you're reading it!)
```

## Available Scripts

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
| `pnpm test`         | Run unit tests with Vitest              |
| `pnpm test:e2e`     | Run E2E tests with Playwright           |

## Environment Configuration

Copy the example environment file to get started:

```bash
cp .env.example .env
```

Key environment variables:

| Variable              | Description                            | Default                        |
| --------------------- | -------------------------------------- | ------------------------------ |
| `NODE_ENV`            | Environment mode                       | `development`                  |
| `GEINS_API_ENDPOINT`  | Geins GraphQL endpoint                 | `https://api.geins.io/graphql` |
| `STORAGE_DRIVER`      | KV storage driver                      | `fs`                           |
| `LOG_LEVEL`           | Logging verbosity                      | `info`                         |

See [Environment Variables](/architecture#environment-variables) for the full list.

## Adding Components

The project uses shadcn-vue for UI components. To add a new component:

```bash
pnpm dlx shadcn-vue add button
```

Components are generated in `app/components/ui/`.

## Next Steps

- Learn about the [Multi-Tenant Architecture](/guide/multi-tenant)
- Understand the [Theming System](/guide/theming)
- Read the [Testing Guide](/testing)
- Explore the [API Reference](/guide/api-reference)

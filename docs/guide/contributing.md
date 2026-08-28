# Contributing

This page covers the local setup and the day-to-day tooling.

**How work reaches production — branches, releases, hotfixes, commit format — lives in
[`CONTRIBUTING.md`](https://github.com/geins-io/sales-portal/blob/main/CONTRIBUTING.md) at the
repository root.** That file is the source of truth for the flow; this page does not repeat it.

## Development Setup

### Prerequisites

- Node.js 20 or newer
- PNPM 9+
- Git
- GitHub CLI (`gh`) — optional; used by the AI agent instructions in `AGENTS.md`

### Local Development

1. Clone the repository:

   ```bash
   git clone https://github.com/geins-io/sales-portal.git
   cd sales-portal
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Copy the environment file and read the notes in it:

   ```bash
   cp .env.example .env
   ```

   Which tenant you see locally depends on this file. See
   [Multi-Tenant Architecture](/guide/multi-tenant#local-development) before you start the server.

4. Branch off `main`, named `type/short-description`:

   ```bash
   git checkout -b fix/cart-quantity-rounding
   ```

5. Start the development server:

   ```bash
   pnpm dev
   ```

## Code Standards

Conventions live in [`docs/conventions/`](/conventions/README) — component structure, composables,
API clients, error handling, i18n, icons, runtime config and SSR safety. Read the relevant one
before adding code; they are short.

### Formatting

Prettier owns formatting. Husky and `lint-staged` run `eslint --fix` and `prettier --write` over
staged files on every commit, so a normal commit formats itself. To run it across the repo:

```bash
pnpm format        # write
pnpm format:check  # verify without writing
```

### Linting

```bash
pnpm lint      # report
pnpm lint:fix  # auto-fix
```

`any`, `@ts-ignore` and `@ts-expect-error` are lint errors, not warnings. When SDK types are
missing a field the GraphQL query returns, extend the type in `shared/types/commerce.ts`.

### Type Checking

```bash
pnpm typecheck
```

## Testing

```bash
pnpm test           # unit + component (Vitest)
pnpm test:coverage  # with coverage
pnpm test:e2e       # end-to-end (Playwright)
```

Unit and component tests run against a clean checkout. The E2E suite drives a real browser against
a running server and a tenant hostname that resolves; see
[Multi-Tenant Architecture](/guide/multi-tenant#local-development).

Where tests go:

- **Unit tests** — `tests/unit/` or `tests/server/`
- **Component tests** — `tests/components/`
- **E2E tests** — `tests/e2e/`

See the [Testing Guide](/testing) for the full picture.

## Adding Components

The project uses shadcn-vue. Generate a primitive with the CLI:

```bash
pnpm dlx shadcn-vue add button
```

Components land in `app/components/ui/`. For everything else — props, naming, design tokens,
accessibility — follow [conventions/components.md](/conventions/components).

## Commits

Conventional Commits, enforced by `commitlint` on every commit. **The scope is required**:

```
feat(search): add product search
fix(cart): resolve quantity update on variant switch
docs(api): document the quotes endpoints
test(favorites): cover quick-filter search
refactor(tenant): simplify context resolution
```

Allowed types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `style`,
`revert`. The hook rejects a missing scope, a trailing period, and a header over 72 characters. An
imperative, lowercase description is convention rather than hook-enforced.

Full rule, including what must never appear in a message, is in
[`AGENTS.md`](https://github.com/geins-io/sales-portal/blob/main/AGENTS.md).

## Pull Requests

Before you push:

```bash
pnpm typecheck && pnpm test && pnpm lint:fix
```

CI then runs lint, type check, unit tests with coverage, and the E2E smoke specs against a
production build. PR titles follow the commit format; the body carries the rationale, the test
plan and any follow-ups.

## Getting Help

- Check existing [issues](https://github.com/geins-io/sales-portal/issues)
- Review the [documentation](/guide/getting-started)
- Read [Lessons Learned](/lessons-learned) for what has broken before and why

## License

By contributing, you agree that your contributions will be licensed under the project's license.

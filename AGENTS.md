# Sales Portal - AI Agent Instructions

> Single source of truth for all AI coding assistants working on this codebase.

## Project

Multi-tenant storefront on **Nuxt 4 + Vue 3 + Tailwind CSS 4 + Pinia**.

```bash
pnpm install    # Install deps
pnpm dev        # Dev server
pnpm test       # Unit tests
pnpm test:e2e   # E2E tests
pnpm lint:fix   # Fix lint issues
```

## Before You Code

| Task                             | Read First                                 |
| -------------------------------- | ------------------------------------------ |
| Any code change                  | [Conventions](docs/conventions/)           |
| Understanding architecture       | [Architecture](docs/architecture.md)       |
| Why we chose X over Y            | [ADRs](docs/adr/)                          |
| Specific implementation patterns | [Patterns](docs/patterns/)                 |
| What has broken before, and why  | [Lessons Learned](docs/lessons-learned.md) |

## Critical Rules

### State Management

| What                          | Use                             | NOT                    |
| ----------------------------- | ------------------------------- | ---------------------- |
| UI state (sidebar, modals)    | Pinia stores                    | -                      |
| Server data (API responses)   | `useFetch` (see `dedupe` below) | Pinia, custom wrappers |
| Utilities (debounce, storage) | `@vueuse/core`                  | Custom composables     |

### API Calls

```typescript
// Client-side: use useFetch
const { data } = useFetch('/api/products', { dedupe: 'defer' });

// Server-side: use $fetch + pass event to useRuntimeConfig
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event); // Always pass event!
  return await $fetch(`${config.apiUrl}/data`);
});
```

`dedupe` is a per-call-site choice, not one blanket value. `'defer'` keeps an in-flight request and
drops the duplicate — correct where the request key is stable, which is the common case here.
`'cancel'` (Nuxt's default) aborts the in-flight request instead, so the newest parameters win.

### Type Safety

Never silence the compiler. `any`, `@ts-ignore`, and `@ts-expect-error` are lint errors
(`eslint.config.mjs`). When SDK types are missing fields that the GraphQL query returns, extend
the type in `shared/types/commerce.ts` — a cast hides the drift and the next person inherits it.
If an exception is genuinely unavoidable, use a targeted `eslint-disable-next-line` with a reason
on the line above.

### Don't Create

- Custom debounce/throttle composables (use VueUse)
- Custom localStorage composables (use VueUse)
- Custom API wrapper composables (use useFetch directly)
- Abstractions for one-time operations
- Client-side Geins SDK imports — the SDK runs server-side only (Direct mode)

### Do

- Use existing patterns from `docs/patterns/`
- Follow conventions in `docs/conventions/`
- Keep changes minimal and focused
- Update ADRs if you change architectural decisions

## File Structure

```
app/                    # Frontend (Vue components, pages, composables)
server/                 # Backend (API routes, plugins, utils)
shared/                 # Shared types between client/server
docs/                   # Documentation
  ├── adr/              # Architecture Decision Records
  ├── conventions/      # Coding standards
  └── patterns/         # Implementation patterns
```

## Multi-Tenancy

Tenant flows through: Server plugin → `event.context.tenant` → `/api/config` → `useTenant()` composable → Theme CSS injection.

```typescript
// Server: event.context.tenant.hostname
// Client: const { tenant, hasFeature } = useTenant()
```

Never break backwards compatibility with the existing tenant config schema. Tenants are
configured externally in the merchant admin, so a renamed or newly-required field breaks live
sites that have no way to know about the change. Add fields as optional with a default; migrate
in `server/utils/tenant.ts` rather than at the schema boundary. Never hardcode tenant-specific
values anywhere — everything flows through the tenant config.

## Maintaining These Docs

**When to update ADRs:**

- Changing a library/framework choice
- Changing an architectural pattern
- Deprecating a previous decision

**Format:** See [ADR template](docs/adr/_template.md)

**Don't over-document** - if it's obvious from the code, skip it.

## No Generated Documentation in Repo

Do not create or commit generated documentation files (README.md, CONTRIBUTING.md, etc.) unless explicitly requested. The `docs/` directory contains hand-written, curated documentation only.

## Commit Message Format

Conventional Commits — every commit MUST start with `type(scope): description`:

```
fix(tenant): flatten merchant API appSettings response
feat(portal): add saved-lists Id column
chore(deps): bump @geins/crm to 0.10.1
docs(cms-config): document DEFAULT_CMS_CONFIG resolution order
test(favorites): cover quick-filter search
refactor(quote-status): use theme tokens instead of hardcoded palette
```

**Allowed types**: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `style`, `revert`.

**Scope** is the area touched — feature, package, or filename root (`tenant`, `cart`, `portal`, `quotes`, `cms`, `auth`, `deps`, `i18n`, etc). Pick something meaningful, lowercase, single token.

**Description** is the imperative one-liner — what changed, not what was wrong. Lowercase, no period, ≤72 chars.

**Never**:

- Include ticket numbers (`SAL-20`, `#147`) — those belong in the PR body.
- Mention people by name (first or last), private directories (e.g. `local-docs/`), private file paths, internal team names, "stakeholders", "the platform team", "alignment notes", or AI assistants. The only references allowed are repo-internal artifacts: `docs/`, `docs/adr/`, `docs/patterns/`, `docs/conventions/`, in-tree code paths.
- Use vague verbs like "update" or "fix stuff" — say what you did.

This rule applies the same way to commit messages, commit bodies, PR titles, PR descriptions, code comments, JSDoc, READMEs, ADRs, patterns docs, and anything else under `docs/` or in source. If a piece of context can't be expressed without naming a person or a private path, drop the context entirely — the git history and PR description are enough.

PR titles should follow the same format. Body holds the longer rationale, test plan, follow-ups.

## Branching & Release Flow

Full guide in [CONTRIBUTING.md](CONTRIBUTING.md); rationale in [ADR-022](docs/adr/022-dev-main-branching-release-flow.md). The essentials:

- **`production` = what is live in prod.** Hotfix base. Prod deploys promote its already-built image. Moves only on a release or hotfix.
- **`main` = the next release.** Approved features collect here. Free to sit ahead of prod. Features branch off `main` and PR back to it.
- **`dev` = disposable staging.** Auto-deploys to the Azure dev env. The `Sync Dev` workflow rebuilds it on every push to `main` as `main` plus the manifest branches. Never fix anything on `dev`; a rebuild wipes it.
- **Manifest** = `.github/dev-branches.txt` on the `dev-config` branch. Add your branch to ride staging; remove it (and delete the branch) when it merges to `main`.
- **Build once, promote:** images are `sha-<commit>`, built on `dev`/`main`/`v*` tags; `deploy.yml` never builds, it promotes an existing image. Prod runs the exact tested artifact.
- **Feature:** branch off `main`, add to manifest, test on staging, rebase on `main`, PR to `main`.
- **Release:** move `production` to the tested `main` commit, deploy `production` to prod (no rebuild), tag `v*`.
- **Hotfix:** branch off `production`, PR to `production`, tag `v*` to build, deploy the tag to prod, then forward-port to `main`.
- **The rule:** features off `main`, hotfixes off `production`, prod deploys only from `production` or a `v*` tag (enforced by `deploy.yml`). Never push directly to `main`/`production`, never fix on `dev`, never auto-deploy prod.

## Pre-Push Quality Gate

**No failing builds or checks may reach GitHub.** Before pushing any commit, verify locally:

1. `pnpm typecheck` — must pass
2. `pnpm test` — all tests must pass
3. `pnpm lint:fix` — no lint errors
4. `docker build .` — Dockerfile must build successfully (if Dockerfile was modified)

If any of these fail, fix before pushing. Never push broken code to `main`.

**AI assistants must never run `git push`.** Commit locally if asked, then stop and hand back —
a human reviews the diff and pushes. This is not about trust in the change; it is that pushing is
the one step here that is visible to everyone else and awkward to undo. The same applies to
`git commit`: create commits only when explicitly asked, and leave work in the working tree
otherwise. Never delete or skip tests, and never disable a lint rule, to make a gate pass.

## Design Principles

- **Modularity**: each concern (locale, market, theme, access) is independently replaceable. Single-purpose server utils that compose rather than inherit.
- **Isolation test**: "If I ripped this out, what else would break?" — the answer should be "nothing outside its own directory."

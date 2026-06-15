<!-- mint:start v2 -->

## MANDATORY: Use mint for ALL Code Changes

**For ANY task that modifies files in this repo, invoke the `mint` skill FIRST.**

This is not optional. Before writing, editing, or deleting any code:

1. Invoke `mint` with the task description
2. mint auto-routes to the right mode (quick/plan/ship/research/verify)
3. Follow mint's execution flow with gates and reviews

The only exceptions:

- Pure conversation / answering questions
- Reading files to understand context (no modifications)

If you catch yourself thinking "this is just a small fix" or "I'll just edit one file" — STOP. Invoke mint. Small fixes use quick mode. mint decides the workflow, not you.

**NEVER use Claude Code's built-in plan mode (EnterPlanMode/ExitPlanMode).** mint has its own planning flow — Claude Code plan mode is redundant and conflicts with mint's orchestration. Always stay in normal mode and let mint handle planning via its plan/ship modes.

<!-- mint:end -->

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

| Task                             | Read First                           |
| -------------------------------- | ------------------------------------ |
| Any code change                  | [Conventions](docs/conventions/)     |
| Understanding architecture       | [Architecture](docs/architecture.md) |
| Why we chose X over Y            | [ADRs](docs/adr/)                    |
| Specific implementation patterns | [Patterns](docs/patterns/)           |

## Critical Rules

### State Management

| What                          | Use                               | NOT                    |
| ----------------------------- | --------------------------------- | ---------------------- |
| UI state (sidebar, modals)    | Pinia stores                      | -                      |
| Server data (API responses)   | `useFetch` with `dedupe: 'defer'` | Pinia, custom wrappers |
| Utilities (debounce, storage) | `@vueuse/core`                    | Custom composables     |

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

### Don't Create

- Custom debounce/throttle composables (use VueUse)
- Custom localStorage composables (use VueUse)
- Custom API wrapper composables (use useFetch directly)
- Abstractions for one-time operations

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

- **`main` = production.** It stays equal to prod between releases. Reach it only via PR, only when a change is approved and about to ship. Prod deploys are manual (`Deploy` workflow, `environment=prod`) and never automated.
- **`dev` = disposable staging.** Auto-deploys to the Azure dev env. The `Sync Dev` workflow rebuilds it on every push to `main` as `main` plus the branches listed in the manifest. Never fix anything on `dev`; a rebuild wipes it. Fix on the feature branch.
- **Manifest** = `.github/dev-branches.txt` on the `dev-config` branch. Add your branch to ride staging; remove it (and delete the branch) the moment it merges to `main`.
- **Feature:** branch off `main`, add to manifest, test on staging, rebase on `main`, PR to `main`, manual prod deploy.
- **Hotfix:** branch off `main`, PR to `main`, prod deploy. The push to `main` syncs it to staging automatically; never cherry-pick.
- **Never push directly to `main`, never auto-deploy prod, never fix on `dev`.**

## Pre-Push Quality Gate

**No failing builds or checks may reach GitHub.** Before pushing any commit, verify locally:

1. `pnpm typecheck` — must pass
2. `pnpm test` — all tests must pass
3. `pnpm lint:fix` — no lint errors
4. `docker build .` — Dockerfile must build successfully (if Dockerfile was modified)

If any of these fail, fix before pushing. Never push broken code to `main`.

## Design Principles

- **Modularity**: each concern (locale, market, theme, access) is independently replaceable. Single-purpose server utils that compose rather than inherit.
- **Isolation test**: "If I ripped this out, what else would break?" — the answer should be "nothing outside its own directory."

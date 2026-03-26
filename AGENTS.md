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

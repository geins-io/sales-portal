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

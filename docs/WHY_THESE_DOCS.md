# Why This Documentation Structure?

## The Problem

This codebase was heavily "vibecoded" - AI-assisted development without clear guidelines led to:

1. **Redundant abstractions** - Custom composables duplicating VueUse functionality
2. **Inconsistent patterns** - Multiple ways to do the same thing
3. **AI drift** - Each AI session introduced different patterns
4. **No institutional memory** - Decisions weren't documented, so they got repeated or contradicted

## The Solution

### AGENTS.md as Single Source of Truth

All AI coding tools (Claude, Copilot, Cursor, etc.) now read `AGENTS.md` first. This ensures:

- Consistent patterns regardless of which AI tool is used
- Clear "don't do this" rules
- Pointers to detailed docs when needed

### ADRs for Decisions

Architecture Decision Records (`docs/adr/`) capture:

- **Context** - Why we faced this decision
- **Decision** - What we chose
- **Consequences** - What it means going forward

When an AI (or human) wonders "why do we do X?", the ADR explains it.

### Conventions for Patterns

`docs/conventions/` provides copy-paste patterns:

- How to make API calls
- How to handle errors
- When to create composables

## Maintaining These Docs

**Update ADRs when:**

- Changing a library/framework
- Changing an architectural pattern
- Deprecating something

**Don't over-document:**

- If the code is self-explanatory, don't document it
- If it's in the framework docs (Nuxt, Vue), link there
- Keep docs close to the code they describe

## Structure

```
AGENTS.md                 # AI reads this first
CLAUDE.md                 # Points to AGENTS.md
.github/copilot-instructions.md  # Points to AGENTS.md
docs/
├── adr/                  # Why we made decisions
├── conventions/          # How to do common things
├── patterns/             # Copy-paste examples
└── WHY_THESE_DOCS.md     # This file
```

See @AGENTS.md

## AI Attribution

- Never add "Co-Authored-By" lines or AI tool attribution to commit messages or PR descriptions.
- Never mention Claude, Claude Code, or any AI assistant in commit messages or PR bodies.

## Pre-Push Quality Gate

- **No failing builds or checks may reach GitHub.** Before pushing any commit, verify locally:
  1. `pnpm typecheck` — must pass
  2. `pnpm test` — all tests must pass
  3. `pnpm lint:fix` — no lint errors
  4. `docker build .` — Dockerfile must build successfully (if Dockerfile was modified)
- If any of these fail, fix before pushing. Never push broken code to `main`.

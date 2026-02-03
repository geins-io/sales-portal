# Coding Conventions

Standards and patterns for this codebase. Read before contributing.

## Quick Rules

| Do                                                         | Don't                                   |
| ---------------------------------------------------------- | --------------------------------------- |
| Use `useFetch` for API calls in components                 | Create wrapper composables              |
| Use `@vueuse/core` for utilities                           | Write custom debounce/storage/etc       |
| Use Pinia for UI state only                                | Put server data in Pinia                |
| Pass `event` to `useRuntimeConfig(event)` in server routes | Call `useRuntimeConfig()` without event |
| Keep changes minimal and focused                           | Add features beyond what was asked      |

## Files

- [Composables](composables.md) - When and how to create composables
- [Runtime Config](runtime-config.md) - Environment variables and config
- [Error Handling](error-handling.md) - Error patterns for client and server

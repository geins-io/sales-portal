# Hard Blocks — What Agents Can NEVER Do

Violations trigger immediate stop and escalation to user.

## Universal

- NEVER put ticket numbers, scope prefixes, or task IDs in commit messages (no "feat(sal-20):", no "SAL-20:", no scope tags — just describe what changed)
- NEVER `git push` — human reviews and pushes manually
- NEVER modify files outside declared task scope
- NEVER delete or skip tests to make gates pass
- NEVER use `any` type or `@ts-ignore` to silence type errors
- NEVER disable lint rules to make gates pass
- NEVER commit with failing gates
- NEVER fix bad output directly — reset and fix the spec
- NEVER continue after 2 failures on the same spec
- NEVER mock internal modules — only mock external services

## Context Protection

- NEVER read large files in the main orchestrator context
- NEVER run tests or linters in the main orchestrator context
- Subagents return summaries only

## SSR Safety

- NEVER access properties or iterate over async data in Vue templates without null guards. All `v-for`, `Object.keys()`, `Object.entries()`, `.map()`, `.filter()` in templates MUST use optional chaining and nullish coalescing. SSR renders templates before async data resolves -- null access crashes the server with 500.
- NEVER call `window`, `document`, or browser APIs outside `import.meta.client` guards or `onMounted`

## Locale / i18n

- NEVER hardcode locale codes ('en', 'sv') as type casts — use `SupportedLocale` from `shared/utils/locale-market.ts`
- NEVER enable `detectBrowserLanguage` in i18n config — locale detection is handled by Nitro plugin 00 and the validation middleware via cookie
- NEVER pass short locale codes to GraphQL/SDK — always go through `getChannelVariables()` which calls `ensureBcp47Locale()`
- NEVER set the locale cookie from client code — only Nitro plugin 00 and the server-side validation middleware may write it
- NEVER read locale/market from cookies in server utilities when resolvedLocaleMarket is available — use `event.context.resolvedLocaleMarket` (cookie fallback only for API routes where resolvedLocaleMarket is not set)
- NEVER use bare route paths (`to="/login"`, `navigateTo('/')`, `router.push('/portal/orders')`) — always use `localePath()` in components or cookie-based prefix in middleware

## Type-Prefixed Routing (ADR-015)

- NEVER link to category, product, brand, or search pages without their type prefix (`/c/`, `/p/`, `/b/`, `/s/`). Use `categoryPath()`, `productPath()`, `brandPath()`, `searchPath()` from `shared/utils/route-helpers.ts` to build the path, then wrap with `localePath()`.
- NEVER add new page files for typed content outside the prefix directories (`app/pages/c/`, `app/pages/p/`, `app/pages/b/`, `app/pages/s/`). The `[...slug].vue` catch-all is for CMS content only.
- NEVER modify the legacy redirect middleware to redirect to anything other than `/c/` — unknown bare paths default to category. Products must use `/p/` links from the source.

## Project-Specific

- NEVER break backwards compatibility with existing tenant config schema
- NEVER add client-side SDK imports — SDK runs server-side only (Direct mode)
- NEVER create custom composables for things VueUse already provides
- NEVER use `any` type — use proper TypeScript types from @geins/types
- NEVER commit generated docs (README.md, CONTRIBUTING.md) to the repo
- NEVER use `useFetch` on server-side — use `$fetch` with event parameter
- NEVER hardcode tenant-specific values — everything flows through tenant config

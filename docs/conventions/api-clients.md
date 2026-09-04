# API Clients

Three ways to call HTTP APIs from this codebase. Pick the right one.

| Use it for                                                   | Tool                              | Why                                                                                     |
| ------------------------------------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------- |
| Page-level data loads (auto SSR + hydration + caching)       | `useFetch` / `useAsyncData`       | Built-in cookie forwarding on SSR. Handles loading, error, and refresh state.           |
| Same-origin calls from a store, composable, or event handler | `internalFetch` (from `~/utils/`) | Forwards the incoming request's headers (Host, cookie, X-Forwarded-Proto) on SSR.       |
| Raw `$fetch` directly                                        | Only client-only handlers         | No header forwarding on SSR: the tenant resolves as `localhost`, auth-gated routes 401. |

## The rule

**For every call to one of our own `/api/*` routes from outside a page, use `internalFetch`.**

```ts
// BAD: raw $fetch from a store
const data = await $fetch<CheckoutType>('/api/checkout', { query: { cartId } });

// BAD: hand-rolling the same cookie dance at every call site
const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined;
const data = await $fetch<CheckoutType>('/api/checkout', {
  query: { cartId },
  headers,
});

// GOOD
import { internalFetch } from '~/utils/internal-fetch';

const data = await internalFetch<CheckoutType>('/api/checkout', {
  query: { cartId },
});
```

On the server `internalFetch` is `useRequestFetch()`, Nuxt's fetch bound to the
incoming request: it forwards that request's headers — Host, cookie,
X-Forwarded-Proto and the rest — across the internal hop. On the client it is a
passthrough because the browser already sends host and cookies. Why Host is the
one that matters is in [patterns/internal-fetch.md](../patterns/internal-fetch.md).

## Why the bug class is dangerous

Raw `$fetch` to any of our routes fired during SSR carries no Host header, so
the tenant plugin resolves `localhost` — a hostname the merchant API answers with
a real tenant. The call runs with another tenant's credentials and nothing fails
(see [patterns/internal-fetch.md](../patterns/internal-fetch.md)). For an
auth-gated route the visible symptom is different:

1. Runs on the server with no cookies.
2. Hits `requireAuth(event)` which throws 401.
3. The store catches and sets an error.
4. `await callOnce(...)` consumes the failed run; the client never retries.
5. The user sees a banner like "Failed to load checkout" on every hard refresh.

The hard part: this is invisible to client-only navigation, so it passes
local manual testing if you only click through the SPA. It only bites users
who land on the page directly (deep links, bookmarks, refresh, page-back from
a payment provider).

## Choosing between `useFetch` and `internalFetch`

`useFetch` is the right answer when:

- You are in a page or component setup, not a store.
- You want Nuxt to handle the loading/error/refresh state for you.
- The data is keyed to the route and benefits from payload extraction.

`internalFetch` is the right answer when:

- You are inside a Pinia store action.
- You are inside a composable that does not return refs.
- You are inside an event handler that has to call SSR-safe code (e.g. an
  imperatively triggered prefetch that also runs in `useAsyncData`).

## `$api` is not a general-purpose fetcher

`app/plugins/api.ts` provides `useNuxtApp().$api`: an `ofetch` instance with
retry-with-backoff, a timeout and error interceptors. Its `baseURL` is
`runtimeConfig.public.api.baseUrl`, which is `/api` — **our own routes, not the
Geins API.** Read the name as "the retrying client", not "the Geins client": the
browser never calls the Geins API directly, since the SDK runs server-side only
([ADR-004](../adr/004-geins-sdk-service-layer.md)).

During SSR it forwards an allowlist of headers only — `accept`,
`accept-language`, `user-agent`, `host` — so it cannot authenticate an auth-gated
route. Use `useFetch` or `internalFetch` for those.

## Migration audit (2026-05-14)

After the "Failed to load checkout" incident, we audited every `$fetch` call
in stores and composables:

- `stores/checkout.ts` `fetchCheckout`: migrated to `internalFetch`.
- `stores/auth.ts` `fetchUser`: migrated (replaces the prior inline
  `useRequestHeaders(['cookie'])` pattern).
- `stores/cart.ts` `fetchCart`, `stores/quotes.ts` `fetchQuotes` / `fetchQuote`
  and `middleware/resolve-url.global.ts`: migrated later, when the missing
  Host header on internal fetches was found (the first two had copied
  `cookie` + `host` by hand; quotes had neither).
- All other `$fetch` calls in stores are action-triggered (form submits,
  button clicks) and never fire during SSR, so they do not need the
  forwarder. They still must be auth-aware on the server, but the browser
  sends cookies on its own when those actions fire client-side.

The rule is enforced by lint, not just convention: `sales-portal/require-runtime-config-event`
in `eslint.config.mjs` flags `useRuntimeConfig()` calls in `server/**` that omit the event.

# API Clients

Three different ways to call HTTP APIs from this codebase. Pick the right one.

| Use it for                                                   | Tool                              | Why                                                                                     |
| ------------------------------------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------- |
| Page-level data loads (auto SSR + hydration + caching)       | `useFetch` / `useAsyncData`       | Built-in cookie forwarding on SSR. Handles loading, error, and refresh state.           |
| Same-origin calls from a store, composable, or event handler | `internalFetch` (from `~/utils/`) | Forwards the incoming request's cookie header on SSR so auth-gated routes see the user. |
| Calls to the external Geins API (`merchantapi.geins.io`)     | `$api` from `useNuxtApp()`        | Strips our internal cookies so the user's session does not leak to a third party.       |
| Raw `$fetch` directly                                        | Only client-only handlers         | No cookie forwarding on SSR. Anything auth-gated that fires during SSR will return 401. |

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

`internalFetch` is a thin wrapper around `$fetch` that injects the request's
cookie header when it runs on the server. On the client it is a passthrough
because the browser already sends cookies.

## Why the bug class is dangerous

Raw `$fetch` to an auth-gated route fired during SSR:

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

`app/plugins/api.ts` provides `useNuxtApp().$api`, which adds retries and
forwards safe headers only. It is configured for calls to the external Geins
API and explicitly excludes the `cookie` header from the SSR forward list so
we cannot accidentally hand our session over to a third party. Do not use
`$api` for our own `/api/*` routes; it will not authenticate them.

## Migration audit (2026-05-14)

After the "Failed to load checkout" incident, we audited every `$fetch` call
in stores and composables:

- `stores/checkout.ts` `fetchCheckout`: migrated to `internalFetch`.
- `stores/auth.ts` `fetchUser`: migrated (replaces the prior inline
  `useRequestHeaders(['cookie'])` pattern).
- All other `$fetch` calls in stores are action-triggered (form submits,
  button clicks) and never fire during SSR, so they do not need the
  forwarder. They still must be auth-aware on the server, but the browser
  sends cookies on its own when those actions fire client-side.

Future contributors: see `.mint/hard-blocks.md` for the bot-enforced rule.

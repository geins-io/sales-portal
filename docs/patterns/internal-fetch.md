# Internal Fetches During SSR

A server-side call to one of our own `/api/*` routes is a new request to this
same server. Nitro answers it in-process, but it still runs the whole request
pipeline, including tenant resolution, and it carries **only the headers the
call gives it**. Nothing is inherited from the page request.

## The rule

**Every call to our own routes that can run on the server goes through
`internalFetch` (stores, composables, middleware, plugins) or `useFetch`
(page-level data). Never a bare `$fetch`, and never a hand-picked header
list.**

```ts
// BAD: no Host on the server — the tenant plugin resolves `localhost`
const cart = await $fetch<CartType>('/api/cart', { query: { cartId } });

// BAD: copying headers by hand at each call site — the list drifts
const headers = import.meta.server
  ? useRequestHeaders(['cookie', 'host'])
  : undefined;
const cart = await $fetch<CartType>('/api/cart', {
  query: { cartId },
  headers,
});

// GOOD
import { internalFetch } from '~/utils/internal-fetch';

const cart = await internalFetch<CartType>('/api/cart', { query: { cartId } });
```

On the server `internalFetch` is `useRequestFetch()`, Nuxt's fetch bound to
the incoming request. h3 forwards every header of that request except the
hop-by-hop ones (`transfer-encoding`, `accept-encoding`, `connection`,
`keep-alive`, `upgrade`, `expect`) and `accept`, and includes `host` for a
relative URL. So `host`, `cookie` and `x-forwarded-proto` all cross the hop.
On the client it is a plain `$fetch`; the browser sends host and cookies
itself.

## Why Host matters

`server/plugins/02.tenant-context.ts` resolves the tenant of every request
from its Host header. When the header is missing, h3's `getRequestHost`
answers `localhost`, and the merchant API knows that hostname: it returns a
**real** tenant for it. The internal call then runs with that tenant's Geins
credentials, on every SSR page, for every visitor, with nothing failing.
The wrong answer looks like a right one.

Because `localhost` resolves, this class of bug does not show up as an error.
It shows up as a tenant lookup you did not expect.

## The one route that cannot carry a Host

`@nuxtjs/i18n` loads its messages during SSR (production build only) with a
bare `$fetch` on `/_i18n/<hash>/<locale>/messages.json` from its own runtime
code, so no header can be added. The route serves static per-locale JSON and
needs no tenant. The tenant plugin therefore skips the lookup for `/_i18n/`,
as it does for `/_nuxt/`. Any new route in that position gets the same
treatment: skip the lookup, never let it resolve `localhost`.

## Checking

In development the tenant plugin logs one line per lookup:

```
[tenant] resolve host=<hostname> kv=… api=… outcome=…
```

Run the dev server with `LOG_LEVEL=debug CONSOLA_LEVEL=4`, request an SSR
page for a tenant, and grep the log for `resolve host=localhost`. The count
must be zero; every line must carry the tenant's hostname. The unit tests in
`tests/utils/internal-fetch.test.ts` and
`tests/server/plugins/02.tenant-context.test.ts` pin the mechanism.

See also [conventions/api-clients.md](../conventions/api-clients.md) for the
choice between `useFetch`, `internalFetch` and `$api`.

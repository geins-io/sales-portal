# Cart Hydration

How the cart store is populated so that every SSR-rendered route, including
`/checkout`, renders with the user's cart on the very first paint. No flash
from empty to populated, no client-only refetch on every cold load.

## The Plugin

`app/plugins/cart-init.ts` is a universal Nuxt plugin (no `.client` /
`.server` suffix). It runs once per page render on both sides and is the
single owner of cart hydration:

- Server branch: `await cartStore.fetchCart()`. `@pinia/nuxt` auto-serializes
  `pinia.state.value` into the Nuxt payload, so the cart travels to the
  client inside `__NUXT_DATA__`.
- Client branch: if the payload already populated `cart`, return. Otherwise
  (SPA navigation that started client-side, cookie set after initial paint)
  fire `fetchCart()` without awaiting so hydration is never blocked.

The early-exit on `!cartStore.cartId` ensures anonymous visitors with no
cart cookie incur zero round-trips.

## Why a Plugin, Not a Layout

`app/layouts/default.vue` used to call `onMounted(() => cartStore.fetchCart())`.
That hook is client-only, so the SSR HTML always rendered with `cart = null`,
which is the root cause of the empty `/checkout` flash. A plugin runs on the
server too; a layout's `onMounted` does not.

`app/layouts/checkout.vue` never invoked `fetchCart()` at all, so the
checkout page rendered without cart data even after hydration finished:
the page only re-rendered once a consumer-side workaround fetched. Both
layouts now stay free of cart side-effects; the plugin is the only entry
point.

## Forbidden Workarounds

Do NOT add these. They mask hydration gaps instead of fixing them:

- `if (!cartStore.cart) await cartStore.fetchCart()` inside any page or
  component. The store contract is "hydration already ran in the plugin."
- `await useFetch('/api/cart', …)` inside `app/pages/checkout.vue` or any
  other page. The store owns this request.
- Marking the plugin `cart-init.client.ts`. That recreates the original
  bug because the server branch never runs.
- `await cartStore.fetchCart()` on the client branch of the plugin. That
  turns the plugin into a hydration blocker.
- Persisting cart state to localStorage. Pinia payload bridging is the
  right tool.

## Sanity-Check Path

If `pinia.state` ever stops riding the Nuxt payload (Nuxt or `@pinia/nuxt`
upgrade), switch `fetchCart` to use `useAsyncData('cart-state', () =>
$fetch<CartType>('/api/cart', { query: { cartId: cartId.value } }))`. That
hydrates via the data payload by key. The store action would assign
`cart.value = data.value`.

## Testing

`tests/unit/plugins/cart-init.test.ts` covers the four branches:

- `cartId === null` short-circuits on both sides.
- Server branch awaits `fetchCart` exactly once.
- Client branch with `cart` already populated skips `fetchCart`.
- Client branch with `cart === null` calls `fetchCart` without awaiting
  (assertion: the returned promise is still pending after plugin return).

The plugin's logic lives in an exported `initCart(store, mode)` helper so
tests don't need to boot Nuxt or stub `defineNuxtPlugin`.

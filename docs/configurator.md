# Product configurator

Where each part of the configurator lives, how it works and which tests prove it. What the buyer
sees, case by case, is in [How the configurator behaves](/configurator-behaviour).

Exact values are not copied here. The shape of a configuration is `shared/types/configurator.ts`,
the error codes are `server/utils/errors.ts`, and the buyer's text is the `configurator` key in
`app/locales/sv.json` and its siblings.

## Signed out and signed in

**Where it lives**

- `app/utils/product-page-type.ts`, read through `pageTypeOf` in `app/composables/useFeatureAccess.ts`
- `canConfigure` in `shared/utils/feature-access.ts`; `canConfigureServer` in `server/utils/feature-access.ts`
- `requireConfigurator` in `server/utils/configurator-route.ts`
- `app/pages/p/[...alias].vue`, `app/components/pages/ProductDetails.vue`
- `app/components/shared/ProductCard.vue`, `app/utils/favorite-card-item.ts`, `app/pages/portal/saved-lists/[id].vue`
- `app/components/cart/CartSkippedNote.vue`, `app/utils/reorder.ts`
- `isConfigurableProduct`, `withConfigurableFlags` and `configurableCheck` in `server/services/configurator.ts`

**How it works.** A product is configurable when the backend says so. The merchant-API backend
reads the product's type, and the fixture answers from its seeds. The server puts a `configurable`
flag on the product in the product, related, by-aliases, search and list routes, on the purchased
products (`server/services/purchased-products.ts`) and on the order's rows
(`server/services/orders.ts`). One rule picks the page: a configurable product gets the
configurator for a signed-in buyer and the sign-in box for a guest. Every configuration route
answers 404 to a guest, before it reads the body, and 403 in catalogue mode. A card shows the
configure button only when ordering is allowed and the tenant is not in catalogue mode.

**What proves it**

- `tests/unit/product-page-type.test.ts`
- `tests/composables/useFeatureAccess.test.ts`
- `tests/shared/feature-access.test.ts`
- `tests/server/feature-access.test.ts`
- the route tests in `tests/unit/server/api/configurations/`, which run the gate in `harness.ts`
- `tests/server/api/products.test.ts`
- `tests/server/api/search.test.ts`
- `tests/server/api/product-lists.test.ts`
- `tests/server/services/purchased-products.test.ts`
- `tests/components/pages/ProductPage.test.ts`
- `tests/components/pages/ProductDetails.test.ts`
- `tests/components/commerce/ProductCard.test.ts`
- `tests/components/portal/saved-list-detail.test.ts`
- `tests/components/cart/CartSkippedNote.test.ts`
- `tests/unit/stores/cart.test.ts`
- `tests/unit/reorder.test.ts`
- `tests/e2e/configurator.spec.ts`

## Configure

**Where it lives**

- `app/components/pages/ConfiguratorProduct.vue`
- `app/components/product/configurator/`
- `app/utils/configurator-page.ts`, `configurator-form.ts`, `configurator-order.ts`, `configurator-sections.ts`
- `shared/utils/configurator-requirement.ts`, `shared/utils/configurator-choice.ts`
- `server/services/configurator-messages.ts`
- `app/composables/useConfiguratorSession.ts`
- `server/api/configurations/index.post.ts`, `server/api/configurations/[id]/changes.post.ts`

**How it works.** The page opens a session on load and shows the document the provider answers.
Each choice is sent as one batch, and the answer replaces the whole document. The page works out
no rule of the provider's. The one batch it builds itself is a single-choice pick: a deselect for
each chosen row, then the pick (`singleChoiceChanges`). While a batch runs the form is locked and
no second batch is sent. Whether a choice is missing is read from the node, by one rule shared by
client and server. `canCommit` allows a commit when the provider's `isValid` is true, the session
is active with nothing in flight, the product has one SKU, the stock allows it and the page's
quantity matches the line's. A refused change is told apart by the error's code in
`refusedChange`.

**What proves it**

- `tests/unit/composables/useConfiguratorSession.test.ts`
- `tests/unit/configurator-page.test.ts`
- `tests/unit/configurator-form.test.ts`
- `tests/unit/configurator-order.test.ts`
- `tests/unit/configurator-sections.test.ts`
- `tests/unit/shared/configurator-requirement.test.ts`
- `tests/unit/server/services/configurator-messages.test.ts`
- `tests/components/pages/ConfiguratorProduct.test.ts`
- `tests/components/product/configurator/`
- `tests/components/product/ConfiguratorRequiredStatus.test.ts`
- `tests/e2e/configurator.spec.ts`

## Price and specification

**Where it lives**

- `app/components/product/configurator/ConfigurationPanel.vue`, `SpecificationPrice.vue`, `SpecificationRows.vue`, `SpecificationSheet.vue`
- `ConfiguratorOptionPrice.vue`, `ConfiguratorCommitted.vue`; `app/components/cart/LineSpecification.vue`
- `priceBlock`, `basePrice` and `lineBasePrice` in `app/utils/configurator-panel.ts`
- `priceLines` in `app/composables/useSpecificationFormat.ts`
- `sideAmount` in `shared/utils/configurator-price.ts`

**How it works.** Every configurator price reads the buyer's VAT choice from `useVatDisplay`.
`priceBlock` picks the lines: ex VAT gives the net price, the VAT and the total inc VAT; inc VAT
gives the inc price and the VAT. `priceLines` labels them, and `SpecificationPrice.vue` renders
them. On the page the block sits above the specification. The larger sheet and `LineSpecification`
put it in their footer, and `LineSpecification` is the panel the cart, checkout and the order
open. Option prices, rows and the committed summary take their side through `sideAmount`.

`basePrice` gives the "Base price" row: the unit price less every row shown, on the chosen side.
Whether there is a row is decided ex VAT: a negative remainder there, or a missing price, gives
none. Inc VAT, each option is rounded on its own, so the remainder is floored at zero and the
rows can pass the price by a few cents. `lineBasePrice` does the same for a committed line.

**What proves it**

- `tests/unit/configurator-panel.test.ts`
- `tests/unit/shared/configurator-price.test.ts`
- `tests/components/composables/useSpecificationFormat.test.ts`
- `tests/components/product/ConfigurationPanel.test.ts`
- `tests/components/product/configurator/ConfiguratorOptionRow.test.ts`
- `tests/components/product/configurator/ConfiguratorOptionGroup.test.ts`
- `tests/components/product/configurator/ConfiguratorCommitted.test.ts`
- `tests/components/cart/LineSpecification.test.ts`
- `tests/e2e/configurator.spec.ts`

## Add to cart

**Where it lives**

- `commit` in `app/composables/useConfiguratorSession.ts`
- `lineToRaise` in `app/utils/configurator-page.ts`, called by `onSubmit` in `ConfiguratorProduct.vue`
- `app/utils/stock-in-cart.ts`
- `addConfiguredItem` in `app/stores/cart.ts`
- `server/api/configurations/[id]/commit.post.ts`, `server/api/configurations/[id]/cart.post.ts`, `server/api/configurations/reopen.post.ts`
- `ConfigurationAction.vue`, `ConfiguratorAddRetry.vue`, `ConfiguratorCommitted.vue`

**How it works.** A press commits the configuration, adds the commit to the cart and reopens the
new line as a session. A press with no choice sent since then raises that line by one
(`lineToRaise`). The stock rule counts every cart line of the SKU, leaving out the line being
edited; the page stops the add itself. The server answers 409 when the cart the add returns does
not hold the new line. What the cart does with an add past the stock, drop the new line or replace
the one already there, is not verified: the code's comments disagree. A failed add keeps the
commit, so a retry adds it again without a new commit.

**What proves it**

- `tests/unit/configurator-page.test.ts`
- `tests/unit/stock-in-cart.test.ts`
- `tests/unit/composables/useConfiguratorSession.test.ts`
- `tests/unit/stores/cart.test.ts`
- `tests/unit/server/api/configurations/commit.test.ts`
- `tests/unit/server/api/configurations/cart.test.ts`
- `tests/unit/server/api/configurations/reopen.test.ts`
- `tests/unit/server/services/configurator-merchant-api.test.ts` (the 409 for a line the cart did
  not take)
- `tests/components/pages/ConfiguratorProduct.test.ts`
- `tests/e2e/configurator.spec.ts`
- `tests/e2e/configurator-stock.spec.ts` ("Max in cart" only)
- `tests/e2e/configurator-edit.spec.ts`

## The cart

**Where it lives**

- `app/components/cart/CartItem.vue`, `app/components/cart/LineSpecification.vue`
- `updateQuantity` in `app/stores/cart.ts`, with `CONFIGURED_QUANTITY_SETTLE_MS`
- `updateItem` in `server/services/cart.ts`, then `server/services/configured-line-quantity.ts`
- `server/services/line-configuration.ts`; `CartLineConfiguration` in `shared/types/commerce.ts`
- `signInRequired` and `copyCart` in `server/services/cart.ts`; `server/api/auth/login.post.ts`; `app/components/cart/CartSignInPrompt.vue`

**How it works.** A configured line's quantity is never a plain update. The server reopens the
line, sends the quantity as a change, commits, and puts the commit on the same line. The store
settles quick clicks into one change and holds the line meanwhile. At sign-in a configured line is
carried by its commit, never added again by SKU. If one line cannot be carried, the whole copy is
dropped, and sign-in goes on without changing the cart cookie.

**What proves it**

- `tests/unit/server/services/configured-line-quantity.test.ts`
- `tests/unit/server/services/cart.test.ts`
- `tests/unit/stores/cart.test.ts`
- `tests/components/cart/CartItem.test.ts`
- `tests/components/cart/LineSpecification.test.ts`
- `tests/components/cart/CartSignInPrompt.test.ts`
- `tests/server/api/auth/login.test.ts`
- `tests/e2e/configurator.spec.ts`
- `tests/e2e/configurator-edit.spec.ts`

## Editing from the cart

**Where it lives**

- `app/utils/configurator-edit.ts`
- `edit`, `revertEdit`, `cancelEdit` and `swap` in `app/composables/useConfiguratorSession.ts`
- `replaceConfiguredItem` in `app/stores/cart.ts`
- `server/api/configurations/reopen.post.ts`, `server/api/configurations/[id]/cart.put.ts`, `server/api/configurations/[id].delete.ts`

**How it works.** The edit link carries the cart and the line. The page reopens the line in a new
session. An update commits and swaps the commit onto the same line, at the line's quantity. Which
text a failure shows, and whether it offers a retry, is decided in `app/utils/configurator-page.ts`
(`replaceFailureKey`, `replaceRetryable`, `editOpenFailureKey`, `editOpenRetryable`) and by
`reopenFailure` in the session composable.

**What proves it**

- `tests/unit/configurator-edit.test.ts`
- `tests/unit/configurator-page.test.ts`
- `tests/unit/composables/useConfiguratorSession.test.ts`
- `tests/unit/server/api/configurations/reopen.test.ts`
- `tests/unit/server/api/configurations/cart-replace.test.ts`
- `tests/components/product/ConfigurationAction.test.ts`
- `tests/components/pages/ConfiguratorProduct.test.ts`
- `tests/e2e/configurator-edit.spec.ts`

## Session time

**Where it lives**

- `renewDue` and `RENEW_LEAD_MS` in `app/utils/configurator-page.ts`
- `app/composables/useConfiguratorSession.ts`
- `onRestart` in `ConfiguratorProduct.vue`
- `server/services/configurator-replay.ts`, `server/api/configurations/restore.post.ts`
- `server/api/configurations/[id]/renew.post.ts`, `server/api/configurations/[id].delete.ts`

**How it works.** The composable renews the session close to expiry, and only after activity.
An idle page asks on its next check, and a 410 turns into the expired state, not an error. A
restore replays the held choices into a new session, all of them or none. Leaving the page sends a
keepalive delete, except while a commit or its add runs.

**What proves it**

- `tests/unit/composables/useConfiguratorSession.test.ts`
- `tests/unit/configurator-page.test.ts`
- `tests/unit/server/services/configurator-replay.test.ts`
- `tests/unit/server/api/configurations/cpq-walk.test.ts`
- `tests/unit/server/api/configurations/renew.test.ts`
- `tests/unit/server/api/configurations/restore.test.ts`
- `tests/components/product/ConfigurationPanel.test.ts`
- `tests/e2e/configurator.spec.ts`
- `tests/e2e/configurator-edit.spec.ts`

## Checkout and the order

**Where it lives**

- `app/components/checkout/CheckoutCartItems.vue`, `app/pages/checkout.vue`
- `app/pages/portal/orders/[id].vue`, `app/components/portal/PortalItemRowsSheet.vue`
- `getOrder` and `toOrderDetail` in `server/services/orders.ts`
- `app/utils/configurator-replay.ts`
- `server/api/configurations/from-order.post.ts`, `server/services/configurator-replay.ts`
- `app/utils/reorder.ts`; `canReorder` in `app/pages/portal/orders/[id].vue`

**How it works.** Checkout waits while a line's quantity is changing. Outside quotation mode its
lines take a quantity change and a remove, through the same cart store. The order is one read:
`toOrderDetail` puts each row's configuration and `configurable` flag on the row. A configured row
whose product has a `canonicalUrl` links to the product page with the row in the address. The
server reads that row's choices and replays them into a new session at quantity one. Reorder leaves
out configured rows and configurable rows without a configuration. `canReorder` shows the button
only with reorder access, outside catalogue mode, and with a line left to add.

**What proves it**

- `tests/components/checkout/CheckoutCartItems.test.ts`
- `tests/components/pages/checkout.test.ts`
- `tests/server/services/orders.test.ts`
- `tests/unit/configurator-replay.test.ts`
- `tests/unit/server/services/configurator-replay.test.ts`
- `tests/unit/reorder.test.ts`
- `tests/components/pages/order-detail.test.ts`
- `tests/components/portal/PortalItemRowsSheet.test.ts`
- `tests/e2e/configurator-from-order.spec.ts`
- `tests/e2e/portal.spec.ts`
- `tests/e2e/orders/order-placement.spec.ts`

## How it works underneath

**The backend seam.** Every route talks to `server/services/configurator.ts`. The runtime key
`NUXT_CONFIGURATOR_BACKEND` picks the backend (`server/services/configurator-backend-name.ts`):

- Unset or empty: `merchant-api`, the real provider through the Geins SDK,
  `server/services/configurator-merchant-api/`.
- `fixture`: an in-memory stand-in with seeded products, `server/services/configurator-fixture/`.
  Only `playwright.config.ts` and CI's e2e set it.
- Anything else stops the server at startup (`server/plugins/06.configurator-backend.ts`).

`NUXT_CONFIGURATOR_MERCHANT_API_URL` points the SDK at another merchant-API host; empty keeps the
ordinary one. Provider error codes become the portal's in `knownFailure`, in
`server/services/configurator-merchant-api/index.ts`. Unknown codes answer 502.

**The session.** `app/composables/useConfiguratorSession.ts` holds one session at a time. Its
states are `idle`, `active`, `expired` and `closed`. Every request but the silent renew and the
delete on leaving goes through one gate, so two are never in flight. `source` is the line the
session was reopened from, `editing` the line being edited, and `changed` whether a choice has
been sent.

**The SDK.** The merchant-API backend calls `oms.configuration` in `@geins/oms`, documented in
[Configuration](https://sdk.geins.dev/packages/oms/configuration). It uses `create`, `get`,
`applyChanges`, `renew`, `delete` and `commit` for sessions. It uses `getCartLines`,
`addCartItem`, `updateCartItem` and `reopenCartItem` for cart lines, and `getOrderLineChoices` for
a replay. A line's `configurationId` and `configuration` are in
[Cart items](https://sdk.geins.dev/packages/oms/cart/items).

## What no test sees

- CI's e2e runs the fixture. The specs that need a real configurable product (editing in depth, the
  stock rule, everything from an order) declare themselves out of scope there.
- No test meets the real provider. `configurator-merchant-api.test.ts` runs the real SDK against a
  stubbed fetch; every other test mocks the backend.
- In Safari a full page load does not delete the session. The e2e test is out of scope on webkit
  and says why. Nothing tests a closed tab.
- Every e2e expiry deletes the session first. A session that really times out is proven by unit
  tests only, and no e2e shows a renew that went through.
- No e2e covers a guest's card on a list or search page.
- No e2e shows "Out of stock" on the configurator.
- No e2e clicks an item in the list of missing choices.
- No e2e changes a choice after an add and presses again, or follows a failed add into a retry.
- No e2e signs in with a configured line in a guest cart, or shows the cart's sign-in prompt.
- No e2e presses "Undo changes", follows a failed update into its retry, or reopens a line the
  provider says is gone.
- The order-placement spec opens the order and checks the configured row's article number,
  quantity and prices. It does not check the row's marker, "Show configuration" or its link.
- What the cart shows after a guest-cart copy fails at sign-in is not verified.
- What the platform's cart does with a configured add past the stock is not verified.

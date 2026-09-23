# Saved lists — client-only

Saved lists (favorites + custom named lists) are **client-side only**.
Persistence is the SDK's `@geins/crm` `ListsSession`, which stores lists
in browser `localStorage`. There is **no server API**, no database, no
cross-device sync. By design.

## Why

Geins doesn't expose a saved-lists API and isn't building one. Lists
are a low-stakes scratchpad feature — building our own persistence
service for them would mean a database, migrations, auth scoping,
backups, scaling. Out of scope for a "thin layer over Geins" project.

The SDK already solves it. Same paradigm as Ralph and any other Geins
client. If Geins ever ships a server-side lists API, the SDK
abstraction lets us upgrade without changing consumer code.

## Trade-offs we accept

- **No cross-device sync.** A list created on desktop doesn't appear
  on the user's phone. For B2B use, this is arguably correct — different
  employees of the same org have different scratchpads.
- **localStorage limits.** Effectively unbounded for any reasonable
  list count. Lost when the user clears browser storage.
- **Item metadata lives beside the list, not in it.** The SDK stores items
  as product alias strings only. The one thing we keep per item is a
  quantity, under our own `saved-list-quantities` key
  (`{ [listId]: { [alias]: qty } }`), never inside the SDK's `geins-lists`
  format. Only quantities other than 1 are stored, so a missing entry —
  including every list saved before quantities existed — reads as 1. No
  price snapshot, no item description: the UI fetches fresh product data
  when rendering, and prices change at cart-add time anyway.

## What's exposed

`useFavoritesStore` (`app/stores/favorites.ts`) is the single entry
point. It wraps the SDK and exposes a Pinia-style API:

```ts
const store = useFavoritesStore();

// Built-in favorites list (always present, can't be deleted)
store.toggle(productAlias);
store.isFavorite(productAlias);
store.items; // string[] — favorited aliases
store.count; // number

// Custom named lists
store.lists; // ProductList[] — excludes favorites
store.favorites; // ProductList | null — the favorites list itself
store.getListById(id); // ProductList | null
store.createList(name); // ProductList | null
store.renameList(id, name);
store.deleteList(id);
store.addItemToList(listId, alias);
store.removeItemFromList(listId, alias);
store.productListIds(alias); // string[] — lists containing this product

// Per-item quantities (saved-list detail)
store.getQuantity(listId, alias); // number, 1 when nothing is stored
store.setQuantity(listId, alias, qty); // 1 removes the stored entry
```

All operations are synchronous (localStorage). The store auto-syncs
its reactive state from the SDK after each mutation, and the same sync
drops the quantity of any item or list that no longer exists — so a
removed and re-added item starts at 1 again.

## Consumers

| Location                                                                               | Purpose                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/components/shared/AddToListDialog.vue` (used by `ProductCard` + `ProductDetails`) | Star button on product cards opens this; pick which list(s) the product belongs to, including a one-click "Create new list" path.                                                                               |
| `app/pages/portal/favorites.vue`                                                       | Renders the built-in favorites list as a product grid.                                                                                                                                                          |
| `app/pages/portal/lists.vue`                                                           | Lists overview — search by name, create new list.                                                                                                                                                               |
| `app/pages/portal/saved-lists/[id].vue`                                                | List detail — items as rows with a stored quantity, rename / delete / add-all-to-cart / remove individual items. The total and both cart actions use the quantity. Items render via `/api/products/by-aliases`. |
| `app/pages/portal/index.vue`                                                           | Portal landing page widget — "Your Lists" with the 5 most recent.                                                                                                                                               |

## SSR behaviour

`localStorage` is browser-only. On SSR:

- `useFavoritesStore` initialises empty (`items = []`, `lists = []`, `favorites = null`).
- Hydration is driven by `app/plugins/favorites-init.client.ts`, which calls `store.initialize()` once the app boots on the client.
- Pages that depend on list contents (favorites, saved-lists detail) SSR with empty state and fill in after hydration.

### Hydration ordering trap (read this before adding similar stores)

It looks tempting to call `initialize()` from inside the Pinia setup factory, gated on `import.meta.client`:

```ts
// DO NOT DO THIS in setup-style Pinia stores
if (import.meta.client) {
  initialize();
}
```

In Nuxt with Pinia, the factory runs on the client AFTER SSR but BEFORE Pinia restores the serialised SSR payload (`nuxtApp.payload.pinia`). Whatever the factory writes to refs gets clobbered moments later by the empty server state. The visible symptom is "data appears only after the first mutation" — the first mutation triggers a fresh sync, which finally lands.

Canonical fix: a `*.client.ts` Nuxt plugin that calls the store's `initialize()` action. Plugins run after Pinia is fully hydrated, so reads from `localStorage` (or any client-only source) stick. See `app/plugins/favorites-init.client.ts` for the reference shape — apply the same pattern to any future client-storage-backed Pinia store.

One exception: a VueUse `useStorage` ref reads `localStorage` at factory time on purpose. The saved-list quantities are one, and the store returns it through Pinia's `skipHydrate()`. Without it, the payload restore overwrites the ref with the server's empty object and `useStorage` writes that back, wiping every stored quantity on each page load.

## Why this is NOT in the merchant API config layer

Lists are **runtime user state**, not tenant configuration. The CMS
slot / menu registry from `cms-config.md` is for tenant-configurable
content areas. Lists are per-user, per-device. Different concept,
different storage model.

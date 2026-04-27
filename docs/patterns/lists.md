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
- **No item-level metadata.** Items are product alias strings only —
  no stored quantity, no price snapshot, no item description. UI fetches
  fresh product data when rendering, and prices change at cart-add
  time anyway.

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
```

All operations are synchronous (localStorage). The store auto-syncs
its reactive state from the SDK after each mutation.

## Consumers

| Location                                                                            | Purpose                                                                                                                                                               |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/components/cms/AddToListDialog.vue` (used by `ProductCard` + `ProductDetails`) | Star button on product cards opens this; pick which list(s) the product belongs to, including a one-click "Create new list" path.                                     |
| `app/pages/portal/favorites.vue`                                                    | Renders the built-in favorites list as a product grid.                                                                                                                |
| `app/pages/portal/lists.vue`                                                        | Lists overview — search by name, create new list.                                                                                                                     |
| `app/pages/portal/saved-lists/[id].vue`                                             | List detail — items as ProductCards, rename / delete / add-all-to-cart / remove individual items. Items render via `/api/products/by-aliases` for fresh product data. |
| `app/pages/portal/index.vue`                                                        | Portal landing page widget — "Your Lists" with the 5 most recent.                                                                                                     |

## SSR behaviour

`localStorage` is browser-only. On SSR:

- `useFavoritesStore` initialises empty (`items = []`, `lists = []`, `favorites = null`).
- The store auto-initialises on the client when first imported (`if (import.meta.client) initialize()`).
- Pages that depend on list contents (favorites, saved-lists detail) gate their rendering on client-side data and SSR with empty state.

## Why this is NOT in the merchant API config layer

Lists are **runtime user state**, not tenant configuration. The CMS
slot / menu registry from `cms-config.md` is for tenant-configurable
content areas. Lists are per-user, per-device. Different concept,
different storage model.

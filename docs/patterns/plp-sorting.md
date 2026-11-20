# PLP sorting

The sort dropdown on product lists and search offers a fixed set of options.
Each maps to a Geins `SortType` GraphQL enum value through `SORT_MAP` in
`shared/utils/filters.ts`, and `buildFilterInput` puts that enum on the
`FilterInputType.sort` field of the products query.

## What each option sorts on

| UI value     | i18n label key            | `SortType` enum     | Lists | Search | Sorts on                                |
| ------------ | ------------------------- | ------------------- | ----- | ------ | --------------------------------------- |
| `relevance`  | `product.sort_relevance`  | none sent           | no    | yes    | Geins match ranking for the search term |
| `name-asc`   | `product.sort_name_asc`   | `ALPHABETICAL`      | yes   | yes    | Name, Swedish order (Å Ä Ö after Z)     |
| `name-desc`  | `product.sort_name_desc`  | `ALPHABETICAL_DESC` | yes   | yes    | Name, reversed                          |
| `newest`     | `product.sort_newest`     | `LATEST`            | yes   | yes    | Roughly newest first (see below)        |
| `price-asc`  | `product.sort_price_asc`  | `PRICE`             | yes   | yes    | Selling price, lowest first             |
| `price-desc` | `product.sort_price_desc` | `PRICE_DESC`        | yes   | yes    | Selling price, highest first            |

`sortValuesFor(page, showPrice)` returns the values a page offers, in this
order, and `SORT_LABEL_KEYS` labels them. The price sorts are left out while
`usePriceVisibility().showPrice` is false, the same flag the price facet and
the VAT selector use (see `plp-filter-visibility.md`).

`relevance` sends no `sort` at all, so the API ranks by match. Without a search
term there is nothing to rank by: a list read with no `sort` came back in a
different order on every read, so lists do not offer it. Even in search, two
reads of the same term can order equally ranked products differently.

## The default sort is a store setting

Category, brand and `/products` open on the store setting
`productList.defaultSort`. Merchants set it in Studio, under Base settings → Product lists.
Search always opens on `relevance`.

- `server/utils/tenant.ts` reads the setting with `normalizeListDefaultSort`. A
  missing, empty or unknown value becomes `name-asc`, so a tenant that has not
  set it gets A-Ö. The schema accepts any value, so a bad one never fails the
  tenant parse. `getPublicConfig` sends the result to the client as
  `productList`.
- `useListSort()` (`app/composables/useListSort.ts`) holds the sort state for
  both list pages. The default it shows is
  `effectiveListDefaultSort(setting, showPrice)`: a price default falls back to
  `name-asc` while prices are hidden for the visitor.
- `showPrice` can be false during SSR and true after login. A visitor who has
  not picked a sort follows the default as it changes, while a picked sort is
  kept.
- The URL carries `?sort=` only while the shown sort differs from the default,
  so a list at its default has no `sort` param. `buildFilterInput` still sends
  the enum, which keeps the order stable across reloads.
- A `?sort=` link is honoured. A value the page does not offer (an old
  `?sort=relevance` on a list, a price sort with hidden prices) shows the
  dropdown placeholder, and the enum is still sent.

## Measured on the Merchant API

Each of the 20 `SortType` values was read twice. The reads covered a whole
catalogue (149 products), one category and two search terms. "Stable" means two
reads gave the same order.

| `SortType`                                     | Result                                                                                                                                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ALPHABETICAL`, `ALPHABETICAL_DESC`            | Exact name order, stable.                                                                                                                                                                                                                        |
| `PRICE`, `PRICE_DESC`                          | Exact price order, stable.                                                                                                                                                                                                                       |
| `LATEST`                                       | 130 of 148 neighbouring pairs newest first by creation date. On a list the order is exactly that of the `RELEVANCE` enum, which the Relevans option never sends. No readable product or SKU date explains the rest. It stays offered as "Nyast". |
| `AVAILABLE_STOCK(_DESC)`, `TOTAL_STOCK(_DESC)` | Exact stock order. `AVAILABLE_*` ignores oversellable stock and `TOTAL_*` counts it. Not offered.                                                                                                                                                |
| `MOST_SOLD`                                    | A stable order of its own, which product reads cannot check against sales. Not offered.                                                                                                                                                          |
| `BRAND`, `CUSTOM_1`–`CUSTOM_5`, `VOTES`        | Exactly the order of the `RELEVANCE` enum: brands interleave, no custom sort values or votes exist. Not offered.                                                                                                                                 |
| `NONE`, `FACET_ORDER`                          | Not stable between reads. Not offered.                                                                                                                                                                                                           |

Rule: before offering a new sort, read it live and check that it orders the
list as its label says. The enum is the contract, not the SDK type snapshot.

## Related

- `shared/utils/filters.ts`: `SORT_MAP`, `SORT_LABEL_KEYS`, `LIST_SORTS`,
  `sortValuesFor`, `normalizeListDefaultSort`, `effectiveListDefaultSort`,
  `buildFilterInput`
- `app/composables/useListSort.ts`: list sort state, used by
  `app/components/pages/ProductList.vue` (category, brand) and
  `app/pages/products/index.vue`
- `app/pages/s/[query].vue`: search, `relevance` default
- `server/utils/tenant.ts`: reads `productList.defaultSort`
- `app/components/product/SortDropdown.vue`, `ProductListToolbar.vue`
- `docs/patterns/plp-filter-visibility.md`: price/stock facet visibility matrix

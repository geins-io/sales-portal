# PLP sorting

The product list sort dropdown offers a fixed set of options. Each maps to a
Geins `SortType` GraphQL enum value through `SORT_MAP` in
`shared/utils/filters.ts`, and `buildFilterInput` puts that enum on the
`FilterInputType.sort` field of the products query.

## What each option sorts on

| UI value     | i18n label key            | `SortType` enum | Sorts on                                      |
| ------------ | ------------------------- | --------------- | --------------------------------------------- |
| `relevance`  | `product.sort_relevance`  | `RELEVANCE`     | Geins relevance ranking. This is the default. |
| `price-asc`  | `product.sort_price_asc`  | `PRICE`         | Unit price, lowest first.                     |
| `price-desc` | `product.sort_price_desc` | `PRICE_DESC`    | Unit price, highest first.                    |
| `newest`     | `product.sort_newest`     | `LATEST`        | Product date, newest first.                   |
| `name-asc`   | `product.sort_name_asc`   | `ALPHABETICAL`  | Product name, A to Ö.                         |

`relevance` is special: `buildFilterInput` omits the `sort` field entirely for
it (and the URL sync omits `?sort=`), so the API applies its own default
ordering. Every other value sends its enum; an unknown key falls back to
`RELEVANCE`.

## Validation

All five enum values were checked against the live Merchant API `SortType`
enum and are valid members (the enum also exposes `ALPHABETICAL_DESC`,
`MOST_SOLD`, stock variants, etc. that the UI does not surface). No mapping bug
exists: `PRICE` is ascending and `PRICE_DESC` is descending, matching the
"Pris: Lägst först" / "Pris: Högst först" labels.

Rule: when adding a sort option, confirm the target value against the live
`SortType` enum before wiring a new `SORT_MAP` entry. The enum is the contract,
not the SDK type snapshot.

## Hide price sorts when prices are hidden

`sortOptions` in `app/components/pages/ProductList.vue` drops `price-asc` and
`price-desc` when `usePriceVisibility().showPrice` is `false`. This is the same
store-settings flag the price facet drop and the VAT-display selector already
gate on (see `plp-filter-visibility.md`): a price ordering is meaningless when
the tenant never shows prices.

The current `sortBy` is intentionally NOT rewritten when prices are hidden. A
stale `?sort=price-asc` URL on a hidden-price tenant simply shows the dropdown
placeholder (Reka `SelectValue` has no matching item) while results stay
correctly ordered, because `buildFilterInput` still forwards the enum.
Rewriting `sortBy` at init would be wrong: `showPrice` can be `false` during
SSR and `true` after client auth on tenants whose price access is
`authenticated`, so an init-time rewrite would silently discard a valid
price-sort request after the user logs in.

## Related

- `app/components/pages/ProductList.vue`: `sortOptions`, `sortBy`
- `shared/utils/filters.ts`: `SORT_MAP`, `buildFilterInput`
- `app/components/product/SortDropdown.vue`, `ProductListToolbar.vue`
- `docs/patterns/plp-filter-visibility.md`: price/stock facet visibility matrix

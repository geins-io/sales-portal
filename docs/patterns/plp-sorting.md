# PLP sorting

The product list sort dropdown offers a fixed set of options. Each maps to a
Geins `SortType` GraphQL enum value through `SORT_MAP` in
`shared/utils/filters.ts`, and `buildFilterInput` puts that enum on the
`FilterInputType.sort` field of the products query.

## What each option sorts on

| UI value     | i18n label key            | `SortType` enum | Sorts on                            |
| ------------ | ------------------------- | --------------- | ----------------------------------- |
| `relevance`  | `product.sort_relevance`  | `RELEVANCE`     | Geins relevance ranking.            |
| `price-asc`  | `product.sort_price_asc`  | `PRICE`         | Unit price, lowest first.           |
| `price-desc` | `product.sort_price_desc` | `PRICE_DESC`    | Unit price, highest first.          |
| `newest`     | `product.sort_newest`     | `LATEST`        | Product date, newest first.         |
| `name-asc`   | `product.sort_name_asc`   | `ALPHABETICAL`  | Product name, A to Ö.               |

`relevance` is special at the API layer: `buildFilterInput` omits the `sort`
field entirely for it, so the Geins API applies its own ranking. Every other
value (including `newest`) sends its enum; an unknown key falls back to
`RELEVANCE`.

## Default sort per page

The default depends on the page, and the two defaults are intentionally
different:

| Page                                                     | Default sort | Why                                                                                       |
| -------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| Product lists: category (`/c`), brand (`/b`), `/products` | `newest`     | `relevance` with no sort param yields a non-deterministic API order that reshuffles on each reload. `newest` (`LATEST`) gives a stable, predictable order. |
| Search results (`/s/{query}`)                             | `relevance`  | The API ranks search results by match quality, which is the meaningful order for a query. |

Each page declares its default as a local `DEFAULT_SORT` constant:
`'newest'` in `ProductList.vue` (category and brand) and
`app/pages/products/index.vue`, `'relevance'` in `app/pages/s/[query].vue`.
The list pages initialise `sortBy` from `route.query.sort ?? DEFAULT_SORT` so a
shared `?sort=` link is honoured; search initialises straight from
`DEFAULT_SORT` (it does not read `?sort=`).

The URL sync omits `?sort=` when `sortBy` equals that page's `DEFAULT_SORT`, so
the default never appears in the URL and a stray `?sort=newest` is never
written. Any non-default value is written to the URL.

Note the URL omit and the API-param omit are now decoupled: on a list at the
`newest` default the URL carries no `?sort=`, yet `buildFilterInput` still sends
`sort: LATEST` (because `newest !== 'relevance'`), which is what makes the order
stable across reloads.

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

- `app/components/pages/ProductList.vue`: `sortOptions`, `sortBy`, `DEFAULT_SORT` (`newest`)
- `app/pages/products/index.vue`: full-catalogue list, `DEFAULT_SORT` (`newest`)
- `app/pages/s/[query].vue`: search, `DEFAULT_SORT` (`relevance`)
- `shared/utils/filters.ts`: `SORT_MAP`, `buildFilterInput`
- `app/components/product/SortDropdown.vue`, `ProductListToolbar.vue`
- `docs/patterns/plp-filter-visibility.md`: price/stock facet visibility matrix

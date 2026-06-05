# PLP filter visibility

The product list filter UI has to do three things the obvious code would get
wrong: identify well-known facets without trusting their localized labels,
honour the per-tenant price/stock visibility matrix, and narrow inside a filter
group when the user searches. Each is load-bearing.

## Classify facets by identity, never by label

A Geins filter facet is `{ filterId, group, label, type, values }`. The
`group` and `label` are hardcoded English strings that change with the
storefront locale, and on real tenants `group` is frequently `null`. On the
live elproman tenant the Price facet arrives as `type`/`filterId` `"Price"`
with `group` null, and the stock facet as `type`/`filterId` `"StockStatus"`
with label `"Stock status"`. Matching on the display label would miss both.

`shared/utils/filters.ts` exposes `isPriceFacet` and `isStockFacet`. Each
normalizes a candidate string (trim, lowercase, strip whitespace and
underscores) and compares the normalized `type`, `filterId`, and `group`
against a single literal token (`"price"` / `"stockstatus"`). Any of the three
matching wins, so `"StockStatus"`, `"Stock status"`, and `"stock_status"` all
resolve to the stock facet.

Rule: classify a well-known facet against the identity triple
`{type, filterId, group}`, never against the localized `label`.

There is a separate normalizer in `app/utils/filter-labels.ts`, but it is for
DISPLAY: it collapses whitespace to underscores to look up an i18n dictionary
key. The two normalizers have different output contracts (identity token vs
dictionary key), so do not merge them.

## Reuse the store-settings visibility matrix

`usePriceVisibility` and `useStockVisibility` already encode the
enabled/access matrix: `enabled: false` hides the facet, `access:
"authenticated"` shows it only when logged in, and no access configured shows
it always.

The `facets` computed in `app/components/pages/ProductList.vue` drops the
price facet when `!showPrice` and the stock facet when `!showStock`, so a
hidden facet disappears from both the filter sheet and the active-filter
pills (the existing `v-if="facets && facets.length > 0"` handles the empty
case). The restored filter state is also passed through `stripHiddenFacetKeys`,
so a hand-edited `?Price=` or `?StockStatus=` URL key for a hidden facet is
removed and cannot silently filter the results.

The topbar inc/ex VAT selector (`VatDisplaySwitcher.vue`) gates its entire
template on `usePriceVisibility().showPrice`, because a VAT-display toggle is
meaningless when prices are hidden. The gate is a root `<template v-if>` so the
hidden selector leaves no empty element in the topbar flex row.

## Filter search narrows within a group

`filteredFacets` in `app/components/product/ProductFilters.vue` runs only when
the search box has a query. For each group it computes the displayed label
(`getFilterGroupLabel(group, t) || label || type || filterId`). If that label
matches the query, the whole group is kept with all its values. Otherwise the
group is narrowed to only its non-hidden values whose labels match, and a group
that ends up with zero matches is dropped. Excluding hidden values from the
match avoids a group that matches only on a hidden value rendering empty.
Reshaped facets keep their `filterId`, so selection state and the accordion key
stay stable.

Rule: do not regress this back to whole-facet matching. The earlier bug only
filtered which groups showed and never the values inside them.

## Related

- `shared/utils/filters.ts`: `isPriceFacet`, `isStockFacet`
- `app/utils/filter-labels.ts`: display-only group label normalizer
- `app/components/pages/ProductList.vue`: `facets`, `stripHiddenFacetKeys`
- `app/components/product/ProductFilters.vue`: `filteredFacets`
- `app/components/shared/VatDisplaySwitcher.vue`: price-gated VAT selector

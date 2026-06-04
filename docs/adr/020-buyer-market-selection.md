---
title: Buyer market selection on login by company delivery country
status: accepted
created: 2026-06-04
author: '@geins-io'
tags: [auth, market, currency, multi-market]
---

# ADR-020: Buyer market selection on login by company delivery country

## Context

A business buyer's product catalog and prices resolve per market, and each
market is bound to a currency. A buyer whose company is priced in one currency
but who is left on a market with a different currency sees an empty catalog (no
products, no prices).

On login the storefront must land the buyer on the market that matches their
company so the catalog resolves to prices they can see. Example: a buyer whose
company delivers to Finland and is priced in EUR must land on the FI market, not
the default SE (SEK) market.

An earlier attempt read `getUser.availableChannels[].availableMarkets[]` and
kept the buyer on their current market whenever it was in that list, otherwise
picked the first entry. Verified against the live API, that approach is wrong
for the exact buyers this ticket is about:

- For a **price-list-restricted organization buyer** (the repro case),
  `getUser.availableChannels` comes back **empty**. There is no market list to
  pick from, so the market never switches and the buyer is stranded on the
  default market.
- Even when the list is populated, it is not restricted to the buyer's pricelist
  currency, so currency alone cannot disambiguate two allowed markets.

So the buyer's own available-market list cannot be the source of truth.

Two inputs ARE reliable:

- The company delivery country, from `getCompany.addresses[]`. Live data: the
  `country` field is the ISO-2 code (e.g. `"FI"`) and the delivery address has
  `addressType: "shipping"`.
- The channel's market catalog, from `getChannel`, which lists every market on
  the channel with its `country { code name }` and `currency { code name }`,
  independent of the buyer.

## Decision

On login, and re-affirmed on `/api/auth/me` so a stale cookie self-heals, select
the market whose **country equals the company's delivery-address country**, from
the **channel's market catalog**. That market's currency is the buyer's
effective currency.

The choice is country-first against the channel catalog, NOT the buyer's
available-market list (empty for restricted org buyers) and NOT currency (the
delivery country uniquely identifies the market; its currency follows).

Rules:

- The delivery address is the first address whose `addressType` contains
  `shipping` or `delivery` (case-insensitive); failing that, the first address
  carrying a country.
- Country comparison normalizes both sides and matches on either the ISO-2 code
  (`FI`) or the English name (`Finland`), since `getCompany` returns the code
  while the channel catalog carries both.
- Only buyers tied to a company have a delivery country. Person buyers and
  anyone without a company resolve to no country and are never force-switched.
- Fallback when no confident match exists (no company, no delivery country, or
  no channel market for that country): keep the buyer on their current market.
  The no-match case is logged (`BUYER_MARKET_NO_MATCH`), never silently
  defaulted.

The selection logic (`selectBuyerMarket` and helpers in
`server/utils/buyer-market.ts`) is pure and unit-tested. The data fetching and
cookie write live in `server/utils/buyer-market-resolver.ts`
(`getCompany` + `getChannel`), called by the two auth handlers.

No SDK change and no new GraphQL query are needed: the fix composes the existing
`getCompany` and `getChannel` services.

## Consequences

- The market lands correctly for price-list-restricted organization buyers, the
  case the previous attempt missed entirely.
- For organization buyers, login and session restore each issue `getCompany` and
  (only when a delivery country is found) `getChannel`. Person buyers stop after
  `getCompany` returns null. These are low-frequency auth paths; the channel
  catalog is a candidate for per-tenant caching if needed.
- The deep-link redirect middleware still reads `getUser` for its membership
  guard and fails open (no redirect) when the list is empty, so it does not
  interfere with the resolved market.
- Country matching depends on the company delivery address carrying a
  recognizable country. When it does not, the buyer is left on their current
  market and the gap is logged rather than guessed.

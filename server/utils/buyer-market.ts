import type { H3Event } from 'h3';
import type { Company } from '#shared/types/company';

/**
 * One market on the tenant channel, with the country and currency needed to
 * match it to a buyer's company. Sourced from the channel's market catalog
 * (`getChannel`), which is the reliable list: a price-list-restricted
 * organization buyer's `getUser.availableChannels` comes back EMPTY, so the
 * buyer's own market list cannot drive the choice.
 */
export interface BuyerMarket {
  alias: string;
  countryCode: string | null;
  countryName: string | null;
  currencyCode: string | null;
}

// --- getChannel payload shape (subset we read) -----------------------------

interface RawChannelMarket {
  id?: string | null;
  alias?: string | null;
  country?: { code?: string | null; name?: string | null } | null;
  currency?: { code?: string | null; name?: string | null } | null;
}

/** The subset of a `getChannel` response this module reads. */
export interface ChannelMarketSource {
  markets?: Array<RawChannelMarket | null> | null;
}

// --- getUser payload shape (subset we read for the deep-link guard) ---------

interface RawAvailableChannel {
  channelId?: string | null;
  availableMarkets?: Array<{ id?: string | null; alias?: string | null } | null> | null;
}

/** The subset of a Geins user payload the deep-link guard reads. */
export interface BuyerMarketSource {
  customerType?: string | null;
  availableChannels?: Array<RawAvailableChannel | null> | null;
}

/** Address types that denote the delivery (as opposed to billing) address. */
const DELIVERY_ADDRESS_TYPE = /shipping|delivery/i;

function normalizeCountry(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

/**
 * The markets on the tenant channel, with country and currency.
 * Cookie-free and side-effect-free. Returns null when no markets are
 * available so callers can fail open.
 */
export function extractChannelMarkets(
  channel: ChannelMarketSource | null | undefined,
): BuyerMarket[] | null {
  const markets = channel?.markets;
  if (!Array.isArray(markets) || markets.length === 0) return null;

  const result: BuyerMarket[] = [];
  for (const m of markets) {
    const alias = m?.alias ?? m?.id;
    if (typeof alias === 'string' && alias.length > 0) {
      result.push({
        alias,
        countryCode: m?.country?.code ?? null,
        countryName: m?.country?.name ?? null,
        currencyCode: m?.currency?.code ?? null,
      });
    }
  }
  return result.length > 0 ? result : null;
}

/**
 * Alias-only list of the markets the buyer is allowed on for the current
 * tenant channel, read from `getUser.availableChannels`. Used only by the
 * deep-link redirect middleware for membership checks. Returns null when the
 * data is unavailable (including the empty list a restricted org buyer gets),
 * so the guard fails open.
 */
export function listBuyerMarkets(
  event: H3Event,
  source: BuyerMarketSource | null | undefined,
): string[] | null {
  const settings = event.context?.tenant?.config?.geinsSettings;
  const channel = settings?.channel;
  const tld = settings?.tld;
  if (!source || !channel || !tld) return null;

  const channelId = `${channel}|${tld}`;
  const channels = source.availableChannels;
  if (!Array.isArray(channels) || channels.length === 0) return null;

  const match = channels.find((c) => c?.channelId === channelId);
  const markets = match?.availableMarkets;
  if (!Array.isArray(markets) || markets.length === 0) return null;

  const aliases = markets
    .map((m) => m?.alias ?? m?.id)
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  return aliases.length > 0 ? aliases : null;
}

/**
 * True when a market's country equals the target country. Compares on both
 * the ISO-2 code and the English name (case-insensitive) because a company
 * address may store either form. (Live data: `getCompany` returns the ISO
 * code, e.g. "FI"; the channel catalog carries both "FI" and "Finland".)
 */
function marketMatchesCountry(market: BuyerMarket, target: string): boolean {
  const t = normalizeCountry(target);
  if (!t) return false;
  return (
    normalizeCountry(market.countryCode) === t ||
    normalizeCountry(market.countryName) === t
  );
}

/** The channel market whose country equals the delivery country, or null. */
export function findMarketForCountry(
  markets: BuyerMarket[],
  deliveryCountry: string | null | undefined,
): BuyerMarket | null {
  if (!deliveryCountry) return null;
  return markets.find((m) => marketMatchesCountry(m, deliveryCountry)) ?? null;
}

/**
 * Pull the delivery-address country from a company. Prefers a
 * shipping/delivery-type address; falls back to the first address that
 * carries a country (companies are usually single-country, and a country is
 * a better signal than none). Returns null when no country is available.
 */
export function getCompanyDeliveryCountry(
  company: Company | null | undefined,
): string | null {
  const addresses = company?.addresses;
  if (!Array.isArray(addresses) || addresses.length === 0) return null;

  const delivery = addresses.find(
    (a) => a?.country && DELIVERY_ADDRESS_TYPE.test(a.addressType ?? ''),
  );
  if (delivery?.country) return delivery.country;

  const anyWithCountry = addresses.find((a) => a?.country);
  return anyWithCountry?.country ?? null;
}

/**
 * Deterministically select the market a logged-in buyer should land on.
 *
 * Picks the channel market whose country equals the buyer company's
 * delivery-address country. That market's currency is the buyer's effective
 * currency, so the catalog resolves to prices the buyer can see.
 *
 * Country is the authoritative signal, not currency or the buyer's own
 * available-market list: a price-list-restricted organization buyer's
 * `getUser.availableChannels` is empty, so the only reliable inputs are the
 * company delivery country and the channel's market catalog. See
 * docs/adr/020-buyer-market-selection.md.
 *
 * Returns the alias to switch to, non-null ONLY when it differs from the
 * current market. Returns null when no change is needed OR no confident match
 * can be made. In the no-match case the buyer is intentionally left on their
 * current market rather than switched to an arbitrary one; the caller logs it.
 */
export function selectBuyerMarket(
  markets: BuyerMarket[] | null | undefined,
  deliveryCountry: string | null | undefined,
  currentMarket: string | null | undefined,
): string | null {
  if (!markets || markets.length === 0) return null;

  const matched = findMarketForCountry(markets, deliveryCountry);
  if (!matched) return null;

  return matched.alias === currentMarket ? null : matched.alias;
}

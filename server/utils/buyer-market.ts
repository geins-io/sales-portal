import type { H3Event } from 'h3';
import type { GeinsUserType } from '@geins/types';
import { getMarketCookie, setMarketCookie } from './cookies';

/**
 * Pure lookup: returns the list of market aliases the user is allowed on for
 * the current tenant channel, or null if the data is unavailable.
 *
 * Cookie-free and side-effect-free. Used by the deep-link redirect
 * middleware and as the inner step of `resolveBuyerMarket`.
 */
export function listBuyerMarkets(
  event: H3Event,
  user: GeinsUserType | undefined | null,
): string[] | null {
  const settings = event.context?.tenant?.config?.geinsSettings;
  const channel = settings?.channel;
  const tld = settings?.tld;
  if (!user || !channel || !tld) return null;

  const channelId = `${channel}|${tld}`;
  const channels = user.availableChannels;
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
 * Resolve and persist the market a logged-in buyer is allowed to use on the
 * current tenant channel.
 *
 * Geins's catalog filters by the active currency (which is bound to the
 * active market). If the buyer's pricelist currency doesn't match the
 * current market's currency, every product query returns empty. The user
 * payload now carries `availableChannels[].availableMarkets`, so on login
 * we pick a market the buyer is actually allowed on and write it to the
 * market cookie. The client then full-reloads to the new
 * `/${market}/${locale}/...` URL.
 *
 * Returns the alias of the market that should be active. Non-null only
 * when the cookie was changed; null when no change was needed or no
 * valid resolution could be made.
 */
export function resolveBuyerMarket(
  event: H3Event,
  user: GeinsUserType | undefined | null,
): string | null {
  const allowedAliases = listBuyerMarkets(event, user);
  if (!allowedAliases) return null;

  const settings = event.context?.tenant?.config?.geinsSettings;
  const currentMarket = getMarketCookie(event) ?? settings?.market;
  if (currentMarket && allowedAliases.includes(currentMarket)) {
    return null;
  }

  const picked = allowedAliases[0]!;
  setMarketCookie(event, picked);
  return picked;
}

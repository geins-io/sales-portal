import type { H3Event } from 'h3';
import * as channelService from '../services/channels';
import * as companyService from '../services/company';
import { getMarketCookie, setMarketCookie } from './cookies';
import {
  type ChannelMarketSource,
  extractChannelMarkets,
  findMarketForCountry,
  getCompanyDeliveryCountry,
  selectBuyerMarket,
} from './buyer-market';
import { logger } from './logger';

/**
 * Resolve and persist the market a logged-in buyer should land on, by matching
 * their company's delivery-address country to the channel's market catalog.
 * Applied on login and re-affirmed on `/api/auth/me` so a stale market cookie
 * self-heals.
 *
 * Inputs (both reliable, unlike `getUser.availableChannels`, which is empty for
 * price-list-restricted organization buyers):
 *   - the company delivery country (`getCompany`), present only for
 *     organization buyers tied to a company;
 *   - the channel's market catalog (`getChannel`), with each market's country
 *     and currency.
 *
 * Returns the new market alias only when it changed (so the client reloads onto
 * the matching `/${market}/${locale}/...` URL); null otherwise. Fails open: any
 * read error resolves to null (no forced switch).
 */
export async function resolveBuyerMarket(
  event: H3Event,
  userToken: string,
): Promise<string | null> {
  // The company delivery country is the authoritative signal. Person buyers
  // (and anyone without a company) get null here, so nothing is switched. The
  // freshly minted auth cookie is on the response at login, not the inbound
  // request, so the token is passed explicitly.
  const company = await companyService
    .getCompany(event, userToken)
    .catch(() => null);
  const deliveryCountry = getCompanyDeliveryCountry(company);
  if (!deliveryCountry) return null;

  const channel = (await channelService
    .getChannel(event)
    .catch(() => null)) as ChannelMarketSource | null;
  const markets = extractChannelMarkets(channel);
  if (!markets) return null;

  const settings = event.context?.tenant?.config?.geinsSettings;
  const currentMarket = getMarketCookie(event) ?? settings?.market ?? null;

  const picked = selectBuyerMarket(markets, deliveryCountry, currentMarket);
  if (!picked) {
    // Surface the case where the delivery country matches no channel market: a
    // data gap worth seeing, never a silent default. The buyer stays put.
    if (!findMarketForCountry(markets, deliveryCountry)) {
      logger.info(
        `[buyer-market] BUYER_MARKET_NO_MATCH: delivery country "${deliveryCountry}" ` +
          `has no matching market in [${markets.map((m) => m.alias).join(', ')}]`,
      );
    }
    return null;
  }

  setMarketCookie(event, picked);
  return picked;
}

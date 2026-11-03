import * as channelService from '../services/channels';
import {
  type ChannelMarketSource,
  extractChannelMarkets,
  marketCurrencies,
} from '../utils/buyer-market';
import { createExternalApiError } from '../utils/errors';
import {
  MARKETS_CACHE_NAME,
  marketsResponseCacheKey,
  storefrontCacheKey,
} from '../utils/tenant';

/**
 * The currency of each channel market, by alias: `{ se: 'SEK', de: 'EUR' }`.
 * The market switcher shows it; the store settings carry no currency.
 *
 * A failed channel read throws instead of returning: Nitro caches only what a
 * handler returns, so a failure is never stored and the next request reads
 * the channel again.
 */
export default defineCachedEventHandler(
  async (event) => {
    const channel = (await channelService.getChannel(
      event,
    )) as ChannelMarketSource | null;
    const markets = extractChannelMarkets(channel);
    if (!markets) throw createExternalApiError('channels');
    return marketCurrencies(markets);
  },
  {
    name: MARKETS_CACHE_NAME,
    getKey: (event) => marketsResponseCacheKey(storefrontCacheKey(event)),
    swr: true,
    maxAge: 60 * 60,
  },
);

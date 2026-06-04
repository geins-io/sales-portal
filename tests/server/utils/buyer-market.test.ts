import { describe, it, expect } from 'vitest';
import type { Company } from '#shared/types/company';
import {
  extractChannelMarkets,
  findMarketForCountry,
  getCompanyDeliveryCountry,
  selectBuyerMarket,
  type BuyerMarket,
  type ChannelMarketSource,
} from '../../../server/utils/buyer-market';

// Mirrors a live channel catalog: se (SEK) and fi (EUR).
function channelCatalog(): ChannelMarketSource {
  return {
    markets: [
      {
        id: 'SE|SEK',
        alias: 'se',
        country: { code: 'SE', name: 'Sweden' },
        currency: { code: 'SEK', name: 'Svenska Kronor' },
      },
      {
        id: 'FI|EUR',
        alias: 'fi',
        country: { code: 'FI', name: 'Finland' },
        currency: { code: 'EUR', name: 'EURO' },
      },
    ],
  };
}

function makeCompany(addresses: Company['addresses']): Company {
  return {
    id: '20',
    name: 'Helsinki city',
    vatNumber: 'FI9573622',
    exVat: true,
    limitedProductAccess: true,
    addresses,
    buyers: null,
  };
}

describe('extractChannelMarkets', () => {
  it('returns markets with country and currency from the channel catalog', () => {
    expect(extractChannelMarkets(channelCatalog())).toEqual<BuyerMarket[]>([
      {
        alias: 'se',
        countryCode: 'SE',
        countryName: 'Sweden',
        currencyCode: 'SEK',
      },
      {
        alias: 'fi',
        countryCode: 'FI',
        countryName: 'Finland',
        currencyCode: 'EUR',
      },
    ]);
  });

  it('returns null when there are no markets', () => {
    expect(extractChannelMarkets(null)).toBeNull();
    expect(extractChannelMarkets({})).toBeNull();
    expect(extractChannelMarkets({ markets: [] })).toBeNull();
  });

  it('falls back to id when alias is missing and tolerates null entries', () => {
    expect(
      extractChannelMarkets({
        markets: [null, { id: 'fi', country: { code: 'FI', name: 'Finland' } }],
      }),
    ).toEqual<BuyerMarket[]>([
      {
        alias: 'fi',
        countryCode: 'FI',
        countryName: 'Finland',
        currencyCode: null,
      },
    ]);
  });
});

describe('getCompanyDeliveryCountry', () => {
  it('prefers a shipping/delivery-type address', () => {
    const company = makeCompany([
      { addressId: '1', country: 'SE', addressType: 'billing' } as never,
      { addressId: '2', country: 'FI', addressType: 'shipping' } as never,
    ]);
    expect(getCompanyDeliveryCountry(company)).toBe('FI');
  });

  it('falls back to the first address carrying a country when no delivery type', () => {
    const company = makeCompany([
      { addressId: '1', country: 'FI', addressType: 'Other' } as never,
    ]);
    expect(getCompanyDeliveryCountry(company)).toBe('FI');
  });

  it('returns null when there are no addresses', () => {
    expect(getCompanyDeliveryCountry(makeCompany(null))).toBeNull();
    expect(getCompanyDeliveryCountry(null)).toBeNull();
  });
});

describe('findMarketForCountry', () => {
  const markets = extractChannelMarkets(channelCatalog())!;

  it('matches on ISO-2 country code (the form getCompany returns)', () => {
    expect(findMarketForCountry(markets, 'FI')?.alias).toBe('fi');
  });

  it('matches on English country name (case-insensitive)', () => {
    expect(findMarketForCountry(markets, 'finland')?.alias).toBe('fi');
  });

  it('returns null when no market matches', () => {
    expect(findMarketForCountry(markets, 'NO')).toBeNull();
    expect(findMarketForCountry(markets, null)).toBeNull();
  });
});

describe('selectBuyerMarket', () => {
  const markets = extractChannelMarkets(channelCatalog())!;

  it('switches a Finnish company off the default SE market to FI', () => {
    expect(selectBuyerMarket(markets, 'FI', 'se')).toBe('fi');
  });

  it('is a no-op when already on the matching market', () => {
    expect(selectBuyerMarket(markets, 'FI', 'fi')).toBeNull();
  });

  it('matches when the company country is the English name', () => {
    expect(selectBuyerMarket(markets, 'Finland', 'se')).toBe('fi');
  });

  it('does not force a switch when there is no delivery country', () => {
    expect(selectBuyerMarket(markets, null, 'se')).toBeNull();
  });

  it('does not force a switch when no market matches the delivery country', () => {
    expect(selectBuyerMarket(markets, 'NO', 'se')).toBeNull();
  });

  it('returns null when there are no markets', () => {
    expect(selectBuyerMarket(null, 'FI', 'se')).toBeNull();
    expect(selectBuyerMarket([], 'FI', 'se')).toBeNull();
  });
});

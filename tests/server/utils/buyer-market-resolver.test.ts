import { describe, it, expect, vi, beforeEach } from 'vitest';

import { resolveBuyerMarket } from '../../../server/utils/buyer-market-resolver';

const mockGetChannel = vi.fn();
vi.mock('../../../server/services/channels', () => ({
  getChannel: (...args: unknown[]) => mockGetChannel(...args),
}));

const mockGetCompany = vi.fn();
vi.mock('../../../server/services/company', () => ({
  getCompany: (...args: unknown[]) => mockGetCompany(...args),
}));

const mockSetMarketCookie = vi.fn();
const mockGetMarketCookie = vi.fn();
vi.mock('../../../server/utils/cookies', () => ({
  setMarketCookie: (...args: unknown[]) => mockSetMarketCookie(...args),
  getMarketCookie: (...args: unknown[]) => mockGetMarketCookie(...args),
}));

function makeEvent() {
  return {
    context: {
      tenant: {
        config: { geinsSettings: { channel: '1', tld: 'se', market: 'se' } },
      },
    },
  } as never;
}

// se (SEK) + fi (EUR), as a live channel catalog returns.
const channelCatalog = {
  markets: [
    {
      id: 'SE|SEK',
      alias: 'se',
      country: { code: 'SE', name: 'Sweden' },
      currency: { code: 'SEK' },
    },
    {
      id: 'FI|EUR',
      alias: 'fi',
      country: { code: 'FI', name: 'Finland' },
      currency: { code: 'EUR' },
    },
  ],
};

const finnishCompany = {
  addresses: [{ addressId: '37', country: 'FI', addressType: 'shipping' }],
};

describe('resolveBuyerMarket (orchestrator)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMarketCookie.mockReturnValue('se');
  });

  it('switches a Finnish-company buyer off SE to FI (the restricted-buyer repro)', async () => {
    mockGetCompany.mockResolvedValue(finnishCompany);
    mockGetChannel.mockResolvedValue(channelCatalog);

    const result = await resolveBuyerMarket(makeEvent(), 'token');

    expect(mockGetCompany).toHaveBeenCalledWith(expect.anything(), 'token');
    expect(mockSetMarketCookie).toHaveBeenCalledWith(expect.anything(), 'fi');
    expect(result).toBe('fi');
  });

  it('is a no-op when the buyer is already on the company-country market', async () => {
    mockGetMarketCookie.mockReturnValue('fi');
    mockGetCompany.mockResolvedValue(finnishCompany);
    mockGetChannel.mockResolvedValue(channelCatalog);

    const result = await resolveBuyerMarket(makeEvent(), 'token');

    expect(mockSetMarketCookie).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('does not fetch the channel or switch when there is no company', async () => {
    mockGetCompany.mockResolvedValue(null);

    const result = await resolveBuyerMarket(makeEvent(), 'token');

    expect(mockGetChannel).not.toHaveBeenCalled();
    expect(mockSetMarketCookie).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('does not switch when the channel catalog is empty', async () => {
    mockGetCompany.mockResolvedValue(finnishCompany);
    mockGetChannel.mockResolvedValue({ markets: [] });

    const result = await resolveBuyerMarket(makeEvent(), 'token');

    expect(mockSetMarketCookie).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});

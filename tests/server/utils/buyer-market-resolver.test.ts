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

const { mockLoggerWarn } = vi.hoisted(() => ({ mockLoggerWarn: vi.fn() }));
vi.mock('../../../server/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
  },
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
        hostname: 'acme.example.test',
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

  it('stays on the market and says so once when the company cannot be read', async () => {
    mockGetCompany.mockRejectedValue(new Error('502'));

    const result = await resolveBuyerMarket(makeEvent(), 'token');

    expect(result).toBeNull();
    expect(mockGetChannel).not.toHaveBeenCalled();
    expect(mockSetMarketCookie).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledOnce();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[buyer-market] company read failed; buyer stays on market se',
      { hostname: 'acme.example.test' },
    );
  });

  it('stays on the market and says so once when the channel cannot be read', async () => {
    mockGetCompany.mockResolvedValue(finnishCompany);
    mockGetChannel.mockRejectedValue(new Error('400'));

    const result = await resolveBuyerMarket(makeEvent(), 'token');

    expect(result).toBeNull();
    expect(mockSetMarketCookie).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledOnce();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[buyer-market] channel read failed; buyer stays on market se',
      { hostname: 'acme.example.test' },
    );
  });

  it.each([
    ['no context', {}],
    ['no tenant', { context: {} }],
    ['a tenant without config', { context: { tenant: { hostname: 'x' } } }],
  ])('fails open on an event with %s', async (_, event) => {
    mockGetMarketCookie.mockReturnValue(undefined);
    mockGetCompany.mockRejectedValue(new Error('502'));

    await expect(resolveBuyerMarket(event as never, 'token')).resolves.toBe(
      null,
    );
    expect(mockLoggerWarn).toHaveBeenCalledOnce();
  });

  it('logs no warning when both reads succeed', async () => {
    mockGetCompany.mockResolvedValue(finnishCompany);
    mockGetChannel.mockResolvedValue(channelCatalog);

    await resolveBuyerMarket(makeEvent(), 'token');

    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it('does not switch when the channel catalog is empty', async () => {
    mockGetCompany.mockResolvedValue(finnishCompany);
    mockGetChannel.mockResolvedValue({ markets: [] });

    const result = await resolveBuyerMarket(makeEvent(), 'token');

    expect(mockSetMarketCookie).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});

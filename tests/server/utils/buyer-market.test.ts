import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveBuyerMarket } from '../../../server/utils/buyer-market';

const setMarketCookie = vi.fn();
const getMarketCookie = vi.fn();

vi.mock('../../../server/utils/cookies', () => ({
  setMarketCookie: (...args: unknown[]) => setMarketCookie(...args),
  getMarketCookie: (...args: unknown[]) => getMarketCookie(...args),
}));

type FakeEvent = { context: { tenant?: { config?: Record<string, unknown> } } };

function makeEvent(channel = '2', tld = 'se', market = 'se'): FakeEvent {
  return {
    context: {
      tenant: { config: { geinsSettings: { channel, tld, market } } },
    },
  };
}

function makeUser(channelId: string, marketAliases: string[]) {
  return {
    availableChannels: [
      {
        channelId,
        availableMarkets: marketAliases.map((alias) => ({
          id: alias,
          alias,
          currency: { code: 'EUR' },
        })),
      },
    ],
  };
}

describe('resolveBuyerMarket', () => {
  beforeEach(() => {
    setMarketCookie.mockReset();
    getMarketCookie.mockReset();
  });

  it('returns null when user is missing', () => {
    expect(resolveBuyerMarket(makeEvent() as never, null)).toBeNull();
    expect(resolveBuyerMarket(makeEvent() as never, undefined)).toBeNull();
    expect(setMarketCookie).not.toHaveBeenCalled();
  });

  it('returns null when tenant config has no channel/tld', () => {
    const event = { context: { tenant: { config: {} } } };
    expect(
      resolveBuyerMarket(event as never, makeUser('2|se', ['se']) as never),
    ).toBeNull();
  });

  it('returns null when user has no availableChannels', () => {
    const event = makeEvent();
    expect(
      resolveBuyerMarket(event as never, { someOtherField: 1 } as never),
    ).toBeNull();
    expect(setMarketCookie).not.toHaveBeenCalled();
  });

  it('returns null when no channel matches the current tenant channelId', () => {
    const event = makeEvent('2', 'se');
    const user = makeUser('5|fi', ['fi']);
    expect(resolveBuyerMarket(event as never, user as never)).toBeNull();
    expect(setMarketCookie).not.toHaveBeenCalled();
  });

  it('returns null when the matched channel has no markets', () => {
    const event = makeEvent('2', 'se');
    const user = makeUser('2|se', []);
    expect(resolveBuyerMarket(event as never, user as never)).toBeNull();
  });

  it('returns null when current market cookie is already an allowed market', () => {
    const event = makeEvent('2', 'se', 'fi');
    getMarketCookie.mockReturnValue('fi');
    const user = makeUser('2|se', ['fi', 'de']);
    expect(resolveBuyerMarket(event as never, user as never)).toBeNull();
    expect(setMarketCookie).not.toHaveBeenCalled();
  });

  it('falls back to tenant.market when no cookie is set', () => {
    const event = makeEvent('2', 'se', 'se');
    getMarketCookie.mockReturnValue(undefined);
    const user = makeUser('2|se', ['se', 'fi']);
    expect(resolveBuyerMarket(event as never, user as never)).toBeNull();
    expect(setMarketCookie).not.toHaveBeenCalled();
  });

  it('switches cookie and returns the new alias when current market is not allowed', () => {
    const event = makeEvent('2', 'se', 'se');
    getMarketCookie.mockReturnValue('se');
    const user = makeUser('2|se', ['fi', 'de']);
    expect(resolveBuyerMarket(event as never, user as never)).toBe('fi');
    expect(setMarketCookie).toHaveBeenCalledWith(event, 'fi');
  });

  it('prefers alias over id when both are present', () => {
    const event = makeEvent('2', 'se', 'se');
    getMarketCookie.mockReturnValue('se');
    const user = {
      availableChannels: [
        {
          channelId: '2|se',
          availableMarkets: [
            { id: 'fi-id', alias: 'fi', currency: { code: 'EUR' } },
          ],
        },
      ],
    };
    expect(resolveBuyerMarket(event as never, user as never)).toBe('fi');
    expect(setMarketCookie).toHaveBeenCalledWith(event, 'fi');
  });

  it('falls back to id when alias is missing', () => {
    const event = makeEvent('2', 'se', 'se');
    getMarketCookie.mockReturnValue('se');
    const user = {
      availableChannels: [
        {
          channelId: '2|se',
          availableMarkets: [{ id: 'fi', currency: { code: 'EUR' } }],
        },
      ],
    };
    expect(resolveBuyerMarket(event as never, user as never)).toBe('fi');
    expect(setMarketCookie).toHaveBeenCalledWith(event, 'fi');
  });

  it('ignores null entries in markets list', () => {
    const event = makeEvent('2', 'se', 'se');
    getMarketCookie.mockReturnValue('se');
    const user = {
      availableChannels: [
        {
          channelId: '2|se',
          availableMarkets: [null, { alias: 'fi', currency: { code: 'EUR' } }],
        },
      ],
    };
    expect(resolveBuyerMarket(event as never, user as never)).toBe('fi');
  });
});

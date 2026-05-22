import { describe, it, expect } from 'vitest';
import type { H3Event } from 'h3';
import type { GeinsUserType } from '@geins/types';
import { listBuyerMarkets } from '../../../server/utils/buyer-market';

function makeEvent(channel?: string, tld?: string): H3Event {
  return {
    context: {
      tenant: {
        config: {
          geinsSettings: {
            ...(channel ? { channel } : {}),
            ...(tld ? { tld } : {}),
          },
        },
      },
    },
  } as unknown as H3Event;
}

function makeUser(
  channels: Array<{
    channelId: string;
    availableMarkets: Array<{ alias?: string; id?: string }>;
  }>,
): GeinsUserType {
  return { availableChannels: channels } as unknown as GeinsUserType;
}

describe('listBuyerMarkets', () => {
  it('returns null when user is null', () => {
    expect(listBuyerMarkets(makeEvent('1', 'se'), null)).toBeNull();
  });

  it('returns null when tenant has no channel', () => {
    const user = makeUser([
      { channelId: '1|se', availableMarkets: [{ alias: 'se' }] },
    ]);
    expect(listBuyerMarkets(makeEvent(undefined, 'se'), user)).toBeNull();
  });

  it('returns null when tenant has no tld', () => {
    const user = makeUser([
      { channelId: '1|se', availableMarkets: [{ alias: 'se' }] },
    ]);
    expect(listBuyerMarkets(makeEvent('1', undefined), user)).toBeNull();
  });

  it('returns null when availableChannels is empty', () => {
    const user = makeUser([]);
    expect(listBuyerMarkets(makeEvent('1', 'se'), user)).toBeNull();
  });

  it('returns null when no channel matches', () => {
    const user = makeUser([
      { channelId: '2|no', availableMarkets: [{ alias: 'no' }] },
    ]);
    expect(listBuyerMarkets(makeEvent('1', 'se'), user)).toBeNull();
  });

  it('returns null when matching channel has empty availableMarkets', () => {
    const user = makeUser([{ channelId: '1|se', availableMarkets: [] }]);
    expect(listBuyerMarkets(makeEvent('1', 'se'), user)).toBeNull();
  });

  it('returns aliases when alias present', () => {
    const user = makeUser([
      {
        channelId: '1|se',
        availableMarkets: [{ alias: 'se' }, { alias: 'no' }],
      },
    ]);
    expect(listBuyerMarkets(makeEvent('1', 'se'), user)).toEqual(['se', 'no']);
  });

  it('falls back to id when alias is missing', () => {
    const user = makeUser([
      { channelId: '1|se', availableMarkets: [{ id: 'm1' }] },
    ]);
    expect(listBuyerMarkets(makeEvent('1', 'se'), user)).toEqual(['m1']);
  });
});

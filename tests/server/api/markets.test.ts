import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';
import { H3Error } from 'h3';

const { createExternalApiError } = await import('../../../server/utils/errors');
const mockGetChannel = vi.fn();

vi.mock('../../../server/services/channels', () => ({
  getChannel: (...args: unknown[]) => mockGetChannel(...args),
}));

type CacheOptions = {
  name?: string;
  getKey?: (event: H3Event) => string;
  swr?: boolean;
  maxAge?: number;
};
let cacheOptions: CacheOptions = {};

vi.stubGlobal(
  'defineCachedEventHandler',
  (fn: unknown, options: CacheOptions) => {
    cacheOptions = options;
    return fn;
  },
);

const { default: marketsHandler } =
  await import('../../../server/api/markets.get');
const handler = marketsHandler as unknown as (
  event: H3Event,
) => Promise<unknown>;

beforeEach(() => {
  vi.clearAllMocks();
});

function createEvent(hostname: string, accountName = 'acme'): H3Event {
  return {
    context: {
      tenant: {
        hostname,
        config: {
          hostname: 'acme.litium.test',
          accountName,
          channelSettings: { channelId: '1|se' },
        },
      },
    },
  } as unknown as H3Event;
}

const event = createEvent('acme.litium.test');

async function rejection(): Promise<H3Error> {
  const error: unknown = await handler(event).then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!(error instanceof H3Error)) throw new Error('expected an H3Error');
  return error;
}

describe('GET /api/markets', () => {
  it('answers each market alias with its currency code', async () => {
    mockGetChannel.mockResolvedValue({
      markets: [
        { alias: 'se', currency: { code: 'SEK' } },
        { alias: 'de', currency: { code: 'EUR' } },
      ],
    });

    await expect(handler(event)).resolves.toEqual({ se: 'SEK', de: 'EUR' });
  });

  // Nitro stores only what the handler returns; a throw leaves the cache
  // empty, so the next request reads the channel again.
  it('throws a 502 when the channel read fails, so nothing is cached', async () => {
    // What getChannel throws: wrapServiceCall turns an SDK failure into this.
    mockGetChannel.mockRejectedValue(createExternalApiError('channels'));

    expect((await rejection()).statusCode).toBe(502);
  });

  it('throws a 502 when the channel has no markets, so nothing is cached', async () => {
    mockGetChannel.mockResolvedValue({ markets: [] });

    expect((await rejection()).statusCode).toBe(502);
  });

  it('answers an empty map when the markets carry no currency', async () => {
    mockGetChannel.mockResolvedValue({ markets: [{ alias: 'se' }] });

    await expect(handler(event)).resolves.toEqual({});
  });

  it('caches for an hour, stale-while-revalidate, under its own name', () => {
    expect(cacheOptions).toMatchObject({
      name: 'markets',
      swr: true,
      maxAge: 3600,
    });
  });

  it('shares one cache entry across the aliases of one storefront', () => {
    const key = cacheOptions.getKey?.(createEvent('acme.litium.test'));

    expect(key).toBeTruthy();
    expect(cacheOptions.getKey?.(createEvent('www.acme.litium.test'))).toBe(
      key,
    );
  });

  it('keeps storefronts apart', () => {
    expect(cacheOptions.getKey?.(createEvent('a.test', 'acme'))).not.toBe(
      cacheOptions.getKey?.(createEvent('a.test', 'other')),
    );
  });

  // Nitro's escapeKey strips every non-word character, so a raw key with
  // dots or pipes could collapse two storefronts into one entry.
  it('uses only word characters in the key', () => {
    expect(cacheOptions.getKey?.(event)).toMatch(/^\w+$/);
  });
});

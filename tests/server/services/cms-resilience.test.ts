import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { H3Event } from 'h3';

// A menu or content area is part of every page: a timed-out read is sent once
// more, and a read that still fails serves the last copy that answered.

const { mockLoggerWarn } = vi.hoisted(() => ({ mockLoggerWarn: vi.fn() }));
vi.mock('../../../server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockAreaGet = vi.fn();
const mockMenuGet = vi.fn();

// The signed-in caller's token hash, or the anonymous identity.
let identity = 'anon';
vi.mock('../../../server/utils/request-identity', () => ({
  ANONYMOUS_IDENTITY: 'anon',
  getRequestIdentity: () => identity,
}));

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue({
    cms: {
      area: { get: (...args: unknown[]) => mockAreaGet(...args) },
      page: { get: vi.fn() },
      menu: { get: (...args: unknown[]) => mockMenuGet(...args) },
    },
  }),
  getRequestChannelVariables: vi
    .fn()
    .mockReturnValue({ channelId: '1', languageId: 'sv-SE', marketId: 'se' }),
  buildRequestContext: vi.fn().mockReturnValue(undefined),
}));

const getPreviewCookieMock = vi.fn().mockReturnValue(false);
vi.stubGlobal('getPreviewCookie', getPreviewCookieMock);
vi.stubGlobal('getCookie', () => undefined);
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal('getRequestLocale', vi.fn().mockReturnValue(undefined));
vi.stubGlobal('getRequestMarket', vi.fn().mockReturnValue(undefined));
vi.stubGlobal('getRequestHeader', vi.fn().mockReturnValue(undefined));

const { getContentArea, getMenu } =
  await import('../../../server/services/cms');

const event = {} as H3Event;

/** What the SDK throws for a read its timeout link cut off. */
function timedOut(): Error {
  return Object.assign(new Error('Request r-1 timed out after 5000ms'), {
    name: 'ApolloError',
    networkError: Object.assign(new Error('timed out'), {
      name: 'TimeoutError',
      code: 'REQUEST_TIMEOUT',
    }),
  });
}

const MENU = { id: 1, title: 'Main', menuItems: [{ id: 10, label: 'Hem' }] };
const AREA = { containers: [{ id: 'c1', content: [{ id: 'w1' }] }] };

/** Moves every lru-cache clock past the 60 s TTL. */
let clock: { mockRestore: () => void } | undefined;

async function pastTheTtl() {
  const now = performance.now();
  clock?.mockRestore();
  clock = vi.spyOn(performance, 'now').mockReturnValue(now + 61_000);
  // lru-cache reads the clock at most once per millisecond.
  await new Promise((resolve) => setTimeout(resolve, 5));
}

describe('CMS reads on every page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMenuGet.mockReset();
    mockAreaGet.mockReset();
    getPreviewCookieMock.mockReturnValue(false);
    identity = 'anon';
  });

  afterEach(() => {
    clock?.mockRestore();
    clock = undefined;
  });

  describe('the menu', () => {
    it('sends a timed-out read once more', async () => {
      mockMenuGet.mockRejectedValueOnce(timedOut()).mockResolvedValueOnce(MENU);

      await expect(
        getMenu({ menuLocationId: 'retry' }, event),
      ).resolves.toEqual(MENU);
      expect(mockMenuGet).toHaveBeenCalledTimes(2);
    });

    it('does not send a read again for any other failure', async () => {
      const refused = new Error('GraphQL errors');
      mockMenuGet.mockRejectedValueOnce(refused);

      await expect(getMenu({ menuLocationId: 'no-retry' }, event)).rejects.toBe(
        refused,
      );
      expect(mockMenuGet).toHaveBeenCalledTimes(1);
    });

    it('serves the last copy that answered when a read fails after the cache expired', async () => {
      mockMenuGet.mockResolvedValueOnce(MENU);
      await getMenu({ menuLocationId: 'last-good' }, event);
      await pastTheTtl();
      mockMenuGet.mockRejectedValue(timedOut());

      await expect(
        getMenu({ menuLocationId: 'last-good' }, event),
      ).resolves.toEqual(MENU);
      // Geins was asked again (the cache had expired) and timed out twice.
      expect(mockMenuGet).toHaveBeenCalledTimes(3);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('last good'),
        { menuLocationId: 'last-good' },
      );
    });

    it('keeps the copy it served for the cache time, so a down Geins is asked once a minute', async () => {
      mockMenuGet.mockResolvedValueOnce(MENU);
      await getMenu({ menuLocationId: 'served-once' }, event);
      await pastTheTtl();
      mockMenuGet.mockRejectedValue(timedOut());
      await getMenu({ menuLocationId: 'served-once' }, event);
      const asked = mockMenuGet.mock.calls.length;

      await expect(
        getMenu({ menuLocationId: 'served-once' }, event),
      ).resolves.toEqual(MENU);
      expect(mockMenuGet).toHaveBeenCalledTimes(asked);
    });

    it('fails when it has never answered', async () => {
      mockMenuGet.mockRejectedValue(timedOut());

      await expect(
        getMenu({ menuLocationId: 'never-answered' }, event),
      ).rejects.toThrow();
    });

    it('neither serves nor keeps a copy for preview', async () => {
      getPreviewCookieMock.mockReturnValue(true);
      mockMenuGet.mockResolvedValue(MENU);
      await getMenu({ menuLocationId: 'preview-only' }, event);

      getPreviewCookieMock.mockReturnValue(false);
      mockMenuGet.mockReset();
      mockMenuGet.mockRejectedValue(timedOut());
      await expect(
        getMenu({ menuLocationId: 'preview-only' }, event),
      ).rejects.toThrow();

      mockMenuGet.mockResolvedValueOnce(MENU);
      await getMenu({ menuLocationId: 'preview-served' }, event);
      await pastTheTtl();
      getPreviewCookieMock.mockReturnValue(true);
      mockMenuGet.mockReset();
      mockMenuGet.mockRejectedValue(timedOut());
      await expect(
        getMenu({ menuLocationId: 'preview-served' }, event),
      ).rejects.toThrow();
    });
  });

  describe('the copies kept', () => {
    /** A menu of about 20 kB, as a large customer menu could be. */
    const LARGE = {
      ...MENU,
      menuItems: Array.from({ length: 200 }, (_, id) => ({
        id,
        label: `Kategori ${id} `.repeat(8),
      })),
    };

    it('keep an anonymous copy however many signed-in sessions read, and stay bounded', async () => {
      mockMenuGet.mockResolvedValue(MENU);
      await getMenu({ menuLocationId: 'flooded' }, event);

      // Every session, and every renewal of one, is a new identity.
      mockMenuGet.mockResolvedValue(LARGE);
      for (let session = 0; session < 1_500; session++) {
        identity = `session-${session}`;
        await getMenu({ menuLocationId: 'flooded' }, event);
      }

      await pastTheTtl();
      mockMenuGet.mockReset();
      mockMenuGet.mockRejectedValue(timedOut());

      identity = 'anon';
      await expect(
        getMenu({ menuLocationId: 'flooded' }, event),
      ).resolves.toEqual(MENU);

      identity = 'session-0';
      await expect(
        getMenu({ menuLocationId: 'flooded' }, event),
      ).rejects.toThrow();
      identity = 'session-1499';
      await expect(
        getMenu({ menuLocationId: 'flooded' }, event),
      ).resolves.toEqual(LARGE);
    });

    it('hold the anonymous menus of a large storefront, past what a signed-in session keeps', async () => {
      // About 2 MB of anonymous copies: more than the signed-in map's bound.
      const locations = Array.from({ length: 80 }, (_, i) => `large-${i}`);
      mockMenuGet.mockResolvedValue(LARGE);
      for (const menuLocationId of locations) {
        await getMenu({ menuLocationId }, event);
      }

      await pastTheTtl();
      mockMenuGet.mockReset();
      mockMenuGet.mockRejectedValue(timedOut());

      await expect(
        getMenu({ menuLocationId: locations[0]! }, event),
      ).resolves.toEqual(LARGE);
    });
  });

  describe('a content area', () => {
    it('sends a timed-out read once more', async () => {
      mockAreaGet.mockImplementation(
        async (vars: { displaySetting: string }) => {
          if (
            vars.displaySetting === 'desktop' &&
            mockAreaGet.mock.calls.length === 1
          ) {
            throw timedOut();
          }
          return AREA;
        },
      );

      const area = await getContentArea(
        { family: 'Retry', areaName: 'Top' },
        event,
      );

      expect(area.containers).toHaveLength(1);
      expect(
        mockAreaGet.mock.calls.filter(
          ([vars]) =>
            (vars as { displaySetting: string }).displaySetting === 'desktop',
        ),
      ).toHaveLength(2);
    });

    it('serves the last copy that answered when a read fails after the cache expired', async () => {
      mockAreaGet.mockResolvedValue(AREA);
      const first = await getContentArea(
        { family: 'LastGood', areaName: 'Top' },
        event,
      );
      await pastTheTtl();
      mockAreaGet.mockReset();
      mockAreaGet.mockRejectedValue(timedOut());

      await expect(
        getContentArea({ family: 'LastGood', areaName: 'Top' }, event),
      ).resolves.toEqual(first);
      expect(mockAreaGet).toHaveBeenCalled();
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('last good'),
        { family: 'LastGood', areaName: 'Top' },
      );
    });

    it('fails when it has never answered', async () => {
      mockAreaGet.mockRejectedValue(timedOut());

      await expect(
        getContentArea({ family: 'NeverAnswered', areaName: 'Top' }, event),
      ).rejects.toThrow();
    });

    it('keeps no copy that lost its mobile leg', async () => {
      mockAreaGet.mockResolvedValue(AREA);
      await getContentArea({ family: 'Partial', areaName: 'Top' }, event);
      await pastTheTtl();
      mockAreaGet.mockReset();
      mockAreaGet.mockImplementation(
        async (vars: { displaySetting: string }) => {
          if (vars.displaySetting === 'mobile') throw new Error('mobile down');
          return { containers: [] };
        },
      );
      await getContentArea({ family: 'Partial', areaName: 'Top' }, event);
      await pastTheTtl();
      mockAreaGet.mockReset();
      mockAreaGet.mockRejectedValue(timedOut());

      const served = await getContentArea(
        { family: 'Partial', areaName: 'Top' },
        event,
      );

      expect(mockAreaGet).toHaveBeenCalled();
      expect(served.containers).toHaveLength(1);
    });
  });
});

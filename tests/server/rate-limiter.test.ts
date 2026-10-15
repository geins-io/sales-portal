import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter, getClientIp } from '../../server/utils/rate-limiter';
import type { H3Event } from 'h3';

const { mockUseRuntimeConfig, mockLoggerWarn } = vi.hoisted(() => ({
  mockUseRuntimeConfig: vi.fn(() => ({ trustedProxyHops: 0 })),
  mockLoggerWarn: vi.fn(),
}));
vi.mock('#imports', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useRuntimeConfig: mockUseRuntimeConfig };
});
vi.mock('#app/nuxt', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useRuntimeConfig: mockUseRuntimeConfig };
});
vi.mock('nitropack/runtime/internal/config', async (importOriginal) => {
  const actual = (await importOriginal().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  return { ...actual, useRuntimeConfig: mockUseRuntimeConfig };
});
vi.mock('../../server/utils/logger', () => ({
  logger: { warn: mockLoggerWarn },
}));

// Mock useStorage to provide an in-memory store for tests
const mockStore = new Map<string, unknown>();
const mockUseStorage = vi.fn(() => ({
  getItem: async <T>(key: string): Promise<T | null> =>
    (mockStore.get(key) as T) ?? null,
  setItem: async (key: string, value: unknown) => {
    mockStore.set(key, value);
  },
  removeItem: async (key: string) => {
    mockStore.delete(key);
  },
  getKeys: async (prefix: string) =>
    [...mockStore.keys()].filter((k) => k.startsWith(prefix)),
}));
vi.stubGlobal('useStorage', mockUseStorage);

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    mockStore.clear();
    rateLimiter = new RateLimiter({
      limit: 3,
      windowMs: 60000,
      prefix: 'test',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('check', () => {
    it('should count in the kv storage', async () => {
      mockUseStorage.mockClear();

      await rateLimiter.check('192.168.1.1');

      expect(mockUseStorage).toHaveBeenCalledWith('kv');
    });

    it('should allow requests under the limit', async () => {
      const result1 = await rateLimiter.check('192.168.1.1');
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);

      const result2 = await rateLimiter.check('192.168.1.1');
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);

      const result3 = await rateLimiter.check('192.168.1.1');
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(0);
    });

    it('should block requests over the limit', async () => {
      await rateLimiter.check('192.168.1.1');
      await rateLimiter.check('192.168.1.1');
      await rateLimiter.check('192.168.1.1');

      const result = await rateLimiter.check('192.168.1.1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track different IPs separately', async () => {
      await rateLimiter.check('192.168.1.1');
      await rateLimiter.check('192.168.1.1');
      await rateLimiter.check('192.168.1.1');

      const result = await rateLimiter.check('192.168.1.2');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should reset after the time window', async () => {
      await rateLimiter.check('192.168.1.1');
      await rateLimiter.check('192.168.1.1');
      await rateLimiter.check('192.168.1.1');

      const blockedResult = await rateLimiter.check('192.168.1.1');
      expect(blockedResult.allowed).toBe(false);

      vi.advanceTimersByTime(60001);

      const result = await rateLimiter.check('192.168.1.1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should provide correct reset time', async () => {
      const now = Date.now();
      await rateLimiter.check('192.168.1.1');
      await rateLimiter.check('192.168.1.1');
      await rateLimiter.check('192.168.1.1');

      const result = await rateLimiter.check('192.168.1.1');
      expect(result.resetTime).toBeGreaterThan(now);
      expect(result.resetTime).toBeLessThanOrEqual(now + 60000);
    });

    it('should use sliding window correctly', async () => {
      await rateLimiter.check('192.168.1.1');

      vi.advanceTimersByTime(30000);

      await rateLimiter.check('192.168.1.1');
      await rateLimiter.check('192.168.1.1');

      const blockedResult = await rateLimiter.check('192.168.1.1');
      expect(blockedResult.allowed).toBe(false);

      vi.advanceTimersByTime(31000);

      const allowedResult = await rateLimiter.check('192.168.1.1');
      expect(allowedResult.allowed).toBe(true);
    });
  });

  describe('getRequestCount', () => {
    it('should return current request count', async () => {
      expect(await rateLimiter.getRequestCount('192.168.1.1')).toBe(0);

      await rateLimiter.check('192.168.1.1');
      expect(await rateLimiter.getRequestCount('192.168.1.1')).toBe(1);

      await rateLimiter.check('192.168.1.1');
      expect(await rateLimiter.getRequestCount('192.168.1.1')).toBe(2);
    });

    it('should not count expired requests', async () => {
      await rateLimiter.check('192.168.1.1');
      await rateLimiter.check('192.168.1.1');

      vi.advanceTimersByTime(60001);

      expect(await rateLimiter.getRequestCount('192.168.1.1')).toBe(0);
    });
  });

  describe('reset', () => {
    it('should clear tracked requests for a specific key', async () => {
      await rateLimiter.check('192.168.1.1');
      await rateLimiter.check('192.168.1.1');
      await rateLimiter.check('192.168.1.2');

      await rateLimiter.reset('192.168.1.1');

      expect(await rateLimiter.getRequestCount('192.168.1.1')).toBe(0);
      expect(await rateLimiter.getRequestCount('192.168.1.2')).toBe(1);
    });

    it('should clear all tracked requests when no key given', async () => {
      await rateLimiter.check('192.168.1.1');
      await rateLimiter.check('192.168.1.2');

      await rateLimiter.reset();

      expect(await rateLimiter.getRequestCount('192.168.1.1')).toBe(0);
      expect(await rateLimiter.getRequestCount('192.168.1.2')).toBe(0);
    });
  });

  describe('refund', () => {
    it('should give back the slot the last check took', async () => {
      await rateLimiter.check('192.168.1.1');
      await rateLimiter.check('192.168.1.1');
      await rateLimiter.check('192.168.1.1');
      expect((await rateLimiter.check('192.168.1.1')).allowed).toBe(false);

      mockUseStorage.mockClear();
      await rateLimiter.refund('192.168.1.1');

      // The same storage check() counts in; any other name would refund nothing.
      expect(mockUseStorage).toHaveBeenCalledWith('kv');
      expect(await rateLimiter.getRequestCount('192.168.1.1')).toBe(2);
      expect((await rateLimiter.check('192.168.1.1')).allowed).toBe(true);
    });

    it('should remove the newest timestamp, not the oldest', async () => {
      await rateLimiter.check('192.168.1.1');
      vi.advanceTimersByTime(30000);
      await rateLimiter.check('192.168.1.1');

      await rateLimiter.refund('192.168.1.1');
      // The first request falls out of the window; nothing else remains.
      vi.advanceTimersByTime(31000);

      expect(await rateLimiter.getRequestCount('192.168.1.1')).toBe(0);
    });

    it('should leave other keys alone', async () => {
      await rateLimiter.check('192.168.1.1');
      await rateLimiter.check('192.168.1.2');

      await rateLimiter.refund('192.168.1.1');

      expect(await rateLimiter.getRequestCount('192.168.1.1')).toBe(0);
      expect(await rateLimiter.getRequestCount('192.168.1.2')).toBe(1);
    });

    it('should remove the key when its last slot is given back', async () => {
      await rateLimiter.check('192.168.1.1');

      await rateLimiter.refund('192.168.1.1');

      expect(mockStore.size).toBe(0);
    });

    it('should do nothing for a key with no requests', async () => {
      await rateLimiter.refund('192.168.1.1');

      expect(mockStore.size).toBe(0);
    });
  });

  describe('prefix isolation', () => {
    it('should isolate different limiter instances by prefix', async () => {
      const limiterA = new RateLimiter({
        limit: 1,
        windowMs: 60000,
        prefix: 'a',
      });
      const limiterB = new RateLimiter({
        limit: 1,
        windowMs: 60000,
        prefix: 'b',
      });

      await limiterA.check('192.168.1.1');

      // limiterA is exhausted, but limiterB should still allow
      const resultA = await limiterA.check('192.168.1.1');
      const resultB = await limiterB.check('192.168.1.1');

      expect(resultA.allowed).toBe(false);
      expect(resultB.allowed).toBe(true);
    });
  });
});

describe('getClientIp', () => {
  function createMockEvent(
    headers: Record<string, string | undefined>,
    remoteAddress?: string,
  ): H3Event {
    return {
      node: {
        req: {
          headers: Object.fromEntries(
            Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
          ),
          socket: {
            remoteAddress,
          },
        },
        res: {},
      },
      context: {},
    } as unknown as H3Event;
  }

  function withHops(trustedProxyHops: number) {
    mockUseRuntimeConfig.mockReturnValue({ trustedProxyHops });
  }

  const SOCKET = '10.0.0.4';

  beforeEach(() => {
    withHops(0);
  });

  describe('with no trusted proxy (hops 0)', () => {
    it('should ignore every forwarding header and use the socket address', () => {
      const event = createMockEvent(
        {
          'x-forwarded-for': '203.0.113.195, 5.150.209.218:52066',
          'x-real-ip': '203.0.113.50',
          'cf-connecting-ip': '203.0.113.100',
        },
        SOCKET,
      );

      expect(getClientIp(event)).toBe(SOCKET);
    });

    it('should use the socket address when no header is sent', () => {
      expect(getClientIp(createMockEvent({}, '::1'))).toBe('::1');
    });

    it('should treat a missing setting as hops 0', () => {
      mockUseRuntimeConfig.mockReturnValue({} as { trustedProxyHops: number });
      const event = createMockEvent(
        { 'x-forwarded-for': '203.0.113.7' },
        SOCKET,
      );

      expect(getClientIp(event)).toBe(SOCKET);
    });
  });

  describe('behind App Service (hops 1)', () => {
    beforeEach(() => {
      withHops(1);
    });

    // The three shapes measured on dev: App Service appends `ip:port` to
    // whatever the client sent.
    it('should strip the port from the entry App Service wrote', () => {
      const event = createMockEvent(
        { 'x-forwarded-for': '5.150.209.218:52066' },
        SOCKET,
      );

      expect(getClientIp(event)).toBe('5.150.209.218');
    });

    it('should ignore one spoofed entry in front of it', () => {
      const event = createMockEvent(
        { 'x-forwarded-for': '203.0.113.41, 5.150.209.218:52066' },
        SOCKET,
      );

      expect(getClientIp(event)).toBe('5.150.209.218');
    });

    it('should ignore two spoofed entries in front of it', () => {
      const event = createMockEvent(
        {
          'x-forwarded-for': '203.0.113.42, 198.51.100.43, 5.150.209.218:52066',
        },
        SOCKET,
      );

      expect(getClientIp(event)).toBe('5.150.209.218');
    });

    it('should strip the port from a bracketed IPv6 entry', () => {
      const event = createMockEvent(
        { 'x-forwarded-for': '203.0.113.41, [2001:db8::1]:52066' },
        SOCKET,
      );

      expect(getClientIp(event)).toBe('2001:db8::1');
    });

    it('should keep a bare IPv6 entry whole', () => {
      const event = createMockEvent(
        { 'x-forwarded-for': '2001:db8::1' },
        SOCKET,
      );

      expect(getClientIp(event)).toBe('2001:db8::1');
    });

    it('should keep an IPv4 entry without a port', () => {
      const event = createMockEvent(
        { 'x-forwarded-for': '5.150.209.218' },
        SOCKET,
      );

      expect(getClientIp(event)).toBe('5.150.209.218');
    });

    it('should trim whitespace around entries', () => {
      const event = createMockEvent(
        { 'x-forwarded-for': '  203.0.113.41  ,  5.150.209.218:52066  ' },
        SOCKET,
      );

      expect(getClientIp(event)).toBe('5.150.209.218');
    });

    it('should fall back to the socket address without the header', () => {
      expect(getClientIp(createMockEvent({}, SOCKET))).toBe(SOCKET);
    });

    it('should fall back to the socket address when the entry is not an IP', () => {
      const event = createMockEvent(
        { 'x-forwarded-for': '5.150.209.218, garbage:1' },
        SOCKET,
      );

      expect(getClientIp(event)).toBe(SOCKET);
    });

    it('should fall back to the socket address for an empty last entry', () => {
      const event = createMockEvent(
        { 'x-forwarded-for': '5.150.209.218,' },
        SOCKET,
      );

      expect(getClientIp(event)).toBe(SOCKET);
    });

    it('should ignore X-Real-IP and CF-Connecting-IP', () => {
      const event = createMockEvent(
        { 'x-real-ip': '203.0.113.50', 'cf-connecting-ip': '203.0.113.100' },
        SOCKET,
      );

      expect(getClientIp(event)).toBe(SOCKET);
    });
  });

  describe('behind two trusted proxies (hops 2)', () => {
    beforeEach(() => {
      withHops(2);
    });

    it('should take the second entry from the right', () => {
      const event = createMockEvent(
        { 'x-forwarded-for': '203.0.113.9, 198.51.100.7:443, 10.0.0.5:5000' },
        SOCKET,
      );

      expect(getClientIp(event)).toBe('198.51.100.7');
    });

    it('should fall back to the socket address, not the leftmost entry, when too short', () => {
      const event = createMockEvent(
        { 'x-forwarded-for': '203.0.113.9' },
        SOCKET,
      );

      expect(getClientIp(event)).toBe(SOCKET);
    });
  });

  it('should return unknown when no IP can be determined', () => {
    expect(getClientIp(createMockEvent({}, undefined))).toBe('unknown');
  });
});

describe('getClientIp warning without a trusted proxy', () => {
  let freshGetClientIp: typeof getClientIp;

  function eventWith(headers: Record<string, string>): H3Event {
    return {
      node: { req: { headers, socket: { remoteAddress: '10.0.0.4' } } },
      context: {},
    } as unknown as H3Event;
  }

  beforeEach(async () => {
    // The warning is once per process: a fresh module per test.
    vi.resetModules();
    mockLoggerWarn.mockClear();
    freshGetClientIp = (await import('../../server/utils/rate-limiter'))
      .getClientIp;
  });

  it('should warn once when X-Forwarded-For arrives with hops 0', () => {
    mockUseRuntimeConfig.mockReturnValue({ trustedProxyHops: 0 });

    freshGetClientIp(eventWith({ 'x-forwarded-for': '203.0.113.7' }));
    freshGetClientIp(eventWith({ 'x-forwarded-for': '203.0.113.8' }));

    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn.mock.calls[0]?.[0]).toContain(
      'NUXT_TRUSTED_PROXY_HOPS',
    );
  });

  it('should not warn with hops 0 when no X-Forwarded-For arrives', () => {
    mockUseRuntimeConfig.mockReturnValue({ trustedProxyHops: 0 });

    freshGetClientIp(eventWith({}));

    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it('should not warn with hops 1', () => {
    mockUseRuntimeConfig.mockReturnValue({ trustedProxyHops: 1 });

    freshGetClientIp(eventWith({ 'x-forwarded-for': '5.150.209.218:52066' }));

    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });
});

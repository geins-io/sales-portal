import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter, getClientIp } from '../../server/utils/rate-limiter';
import type { H3Event } from 'h3';

// Mock useStorage to provide an in-memory store for tests
const mockStore = new Map<string, unknown>();
vi.stubGlobal('useStorage', () => ({
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

  it('should extract IP from x-forwarded-for header', () => {
    const event = createMockEvent(
      { 'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178' },
      '127.0.0.1',
    );

    const ip = getClientIp(event);
    expect(ip).toBe('203.0.113.195');
  });

  it('should extract single IP from x-forwarded-for header', () => {
    const event = createMockEvent(
      { 'x-forwarded-for': '203.0.113.195' },
      '127.0.0.1',
    );

    const ip = getClientIp(event);
    expect(ip).toBe('203.0.113.195');
  });

  it('should extract IP from x-real-ip header', () => {
    const event = createMockEvent({ 'x-real-ip': '203.0.113.50' }, '127.0.0.1');

    const ip = getClientIp(event);
    expect(ip).toBe('203.0.113.50');
  });

  it('should extract IP from cf-connecting-ip header', () => {
    const event = createMockEvent(
      { 'cf-connecting-ip': '203.0.113.100' },
      '127.0.0.1',
    );

    const ip = getClientIp(event);
    expect(ip).toBe('203.0.113.100');
  });

  it('should prefer x-forwarded-for over other headers', () => {
    const event = createMockEvent(
      {
        'x-forwarded-for': '203.0.113.195',
        'x-real-ip': '203.0.113.50',
        'cf-connecting-ip': '203.0.113.100',
      },
      '127.0.0.1',
    );

    const ip = getClientIp(event);
    expect(ip).toBe('203.0.113.195');
  });

  it('should fall back to remote address when no proxy headers', () => {
    const event = createMockEvent({}, '192.168.1.100');

    const ip = getClientIp(event);
    expect(ip).toBe('192.168.1.100');
  });

  it('should return unknown when no IP can be determined', () => {
    const event = createMockEvent({}, undefined);

    const ip = getClientIp(event);
    expect(ip).toBe('unknown');
  });

  it('should handle whitespace in headers', () => {
    const event = createMockEvent(
      { 'x-forwarded-for': '  203.0.113.195  ,  70.41.3.18  ' },
      '127.0.0.1',
    );

    const ip = getClientIp(event);
    expect(ip).toBe('203.0.113.195');
  });
});

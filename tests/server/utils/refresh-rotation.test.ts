import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { H3Event } from 'h3';

const refreshMock = vi.fn();
vi.mock('../../../server/services/auth', () => ({
  refresh: (...args: unknown[]) => refreshMock(...args),
}));

const { rotateOnce, ROTATION_GRACE_MS } =
  await import('../../../server/utils/refresh-rotation');

function eventFor(hostname: string, tenantId?: string): H3Event {
  return { context: { tenant: { hostname, tenantId } } } as unknown as H3Event;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const rotated = {
  succeeded: true,
  user: { username: 'buyer@example.com' },
  tokens: { token: 'new-token', refreshToken: 'new-refresh', expiresIn: 900 },
};

// Every test starts a minute after the previous one, so a grace entry left by
// one test has expired before the next begins.
let clock = Date.UTC(2026, 8, 24, 12, 0, 0);

beforeEach(() => {
  refreshMock.mockReset();
  vi.useFakeTimers();
  clock += 60_000;
  vi.setSystemTime(clock);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('rotateOnce', () => {
  it('makes one Geins call for concurrent requests while the first is still in flight', async () => {
    const pending = deferred<typeof rotated>();
    refreshMock.mockReturnValue(pending.promise);

    const first = rotateOnce('rt-a', eventFor('shop.example'));
    const second = rotateOnce('rt-a', eventFor('shop.example'));
    const third = rotateOnce('rt-a', eventFor('shop.example'));

    expect(refreshMock).toHaveBeenCalledTimes(1);

    pending.resolve(rotated);
    await expect(first).resolves.toBe(rotated);
    await expect(second).resolves.toBe(rotated);
    await expect(third).resolves.toBe(rotated);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('answers from the settled result for the grace window, user included', async () => {
    refreshMock.mockResolvedValue(rotated);

    await rotateOnce('rt-b', eventFor('shop.example'));
    vi.advanceTimersByTime(ROTATION_GRACE_MS - 1);
    const again = await rotateOnce('rt-b', eventFor('shop.example'));

    expect(again).toEqual(rotated);
    expect(again?.user).toEqual({ username: 'buyer@example.com' });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('calls Geins again once the grace window has passed', async () => {
    refreshMock.mockResolvedValue(rotated);

    await rotateOnce('rt-c', eventFor('shop.example'));
    vi.advanceTimersByTime(ROTATION_GRACE_MS);
    await rotateOnce('rt-c', eventFor('shop.example'));

    expect(refreshMock).toHaveBeenCalledTimes(2);
  });

  it('counts the window from settle, not from the call', async () => {
    const pending = deferred<typeof rotated>();
    refreshMock.mockReturnValueOnce(pending.promise);

    const first = rotateOnce('rt-d', eventFor('shop.example'));
    vi.advanceTimersByTime(ROTATION_GRACE_MS * 2);
    pending.resolve(rotated);
    await first;

    vi.advanceTimersByTime(ROTATION_GRACE_MS - 1);
    await rotateOnce('rt-d', eventFor('shop.example'));

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('shares a rejection from Geins with every caller in the window', async () => {
    refreshMock.mockResolvedValue({ succeeded: false });

    const first = await rotateOnce('rt-e', eventFor('shop.example'));
    const second = await rotateOnce('rt-e', eventFor('shop.example'));

    expect(first).toEqual({ succeeded: false });
    expect(second).toEqual({ succeeded: false });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('does not keep a thrown error, so the next request tries again', async () => {
    refreshMock
      .mockRejectedValueOnce(new Error('tenant has no SDK configuration'))
      .mockResolvedValueOnce(rotated);

    await expect(rotateOnce('rt-f', eventFor('shop.example'))).rejects.toThrow(
      'tenant has no SDK configuration',
    );
    await expect(rotateOnce('rt-f', eventFor('shop.example'))).resolves.toBe(
      rotated,
    );
    expect(refreshMock).toHaveBeenCalledTimes(2);
  });

  it('keeps hostnames apart', async () => {
    refreshMock.mockResolvedValue(rotated);

    await rotateOnce('rt-g', eventFor('one.example'));
    await rotateOnce('rt-g', eventFor('two.example'));

    expect(refreshMock).toHaveBeenCalledTimes(2);
  });

  it('keys on the hostname, so a page request and its API hops share one entry', async () => {
    // The tenant plugin sets tenantId on a page request but not on /api/ hops.
    refreshMock.mockResolvedValue(rotated);

    await rotateOnce('rt-h', eventFor('shop.example', 'tenant-1'));
    await rotateOnce('rt-h', eventFor('shop.example'));

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('evicts the oldest entry once 5000 are held', async () => {
    refreshMock.mockReturnValue(new Promise(() => {}));

    for (let i = 0; i < 5001; i++) {
      void rotateOnce(`rt-cap-${i}`, eventFor('cap.example'));
    }
    expect(refreshMock).toHaveBeenCalledTimes(5001);

    void rotateOnce('rt-cap-1', eventFor('cap.example'));
    expect(refreshMock).toHaveBeenCalledTimes(5001);
    void rotateOnce('rt-cap-0', eventFor('cap.example'));
    expect(refreshMock).toHaveBeenCalledTimes(5002);
  });

  it('works without a tenant context', async () => {
    refreshMock.mockResolvedValue(rotated);
    const event = { context: {} } as unknown as H3Event;

    await expect(rotateOnce('rt-k', event)).resolves.toBe(rotated);
  });

  it('keeps refresh tokens apart', async () => {
    refreshMock.mockResolvedValue(rotated);

    await rotateOnce('rt-i', eventFor('shop.example'));
    await rotateOnce('rt-j', eventFor('shop.example'));

    expect(refreshMock).toHaveBeenCalledTimes(2);
  });
});

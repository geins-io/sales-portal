import { describe, it, expect, vi, afterEach } from 'vitest';
import { GeinsCore } from '@geins/core';
import { GeinsCRM } from '@geins/crm';

// Pins EXPIRES_SOON_SECONDS to the real SDK. @geins/crm does not export its
// threshold: `crm.auth.getUser` renews the refresh token on its own when the
// auth token has less than that left, and the caller never sees the new pair.
// If an SDK bump moves the threshold, this fails.

const { EXPIRES_SOON_SECONDS } = await import('../../../server/utils/auth');

function jwt(secondsLeft: number): string {
  const exp = Math.floor(Date.now() / 1000) + secondsLeft;
  const body = btoa(JSON.stringify({ exp, name: 'buyer@example.com' }));
  return `eyJhbGciOiJIUzI1NiJ9.${body.replace(/=+$/, '')}.sig`;
}

function crm(): GeinsCRM {
  const core = new GeinsCore({
    apiKey: 'test-key',
    accountName: 'test-account',
    channel: '1',
    tld: 'se',
    locale: 'sv-SE',
    market: 'se',
    environment: 'prod',
  });
  return new GeinsCRM(core, { clientConnectionMode: 'Direct' });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('@geins/crm getUser renewal threshold', () => {
  it(`renews on its own with ${EXPIRES_SOON_SECONDS - 1} s left`, async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);

    await crm().auth.getUser('refresh-token', jwt(EXPIRES_SOON_SECONDS - 1));

    expect(fetchMock).toHaveBeenCalled();
  });

  it(`only parses the token with ${EXPIRES_SOON_SECONDS + 1} s left`, async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await crm().auth.getUser(
      'refresh-token',
      jwt(EXPIRES_SOON_SECONDS + 1),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result?.succeeded).toBe(true);
  });
});

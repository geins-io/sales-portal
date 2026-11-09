/**
 * Two buyers making the same Geins read at the same moment, through the SDK the
 * portal builds for a storefront, against a real socket. Each read must reach
 * Geins on its own and come back with the answer to its own token.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

vi.mock('../../server/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@sentry/nuxt', () => ({ captureException: vi.fn() }));

const { createTenantSDK } = await import('../../server/services/_sdk');

const QUERY = `
  query probe($channelId: String) {
    probe(channelId: $channelId)
  }
`;

/**
 * Holds every request until the test answers them, so the test can count the
 * requests while every read is still in flight. Each answer names the
 * `Authorization` header its request carried.
 */
async function holdingServer() {
  const held: { auth: string; answer: () => void }[] = [];
  const server = http.createServer((req, res) => {
    req.resume();
    const auth = req.headers.authorization ?? 'none';
    let answered = false;
    held.push({
      auth,
      answer: () => {
        if (answered) return;
        answered = true;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({ data: { probe: auth, getUser: { email: auth } } }),
        );
      },
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  /** Waits until `count` requests are held, then a little longer for any extra. */
  const arrived = async (count: number) => {
    const deadline = Date.now() + 2000;
    while (held.length < count && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  };

  return {
    url: `http://127.0.0.1:${port}/graphql`,
    held,
    arrived,
    answerAll: () => held.forEach((request) => request.answer()),
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

function storefrontAt(apiUrl: string) {
  return createTenantSDK(
    {
      accountName: 'acme',
      apiKey: 'test-key',
      channelSettings: {
        channelId: '1|se',
        defaultLocale: 'sv-SE',
        defaultMarket: 'se',
        locales: ['sv-SE'],
        markets: ['se'],
      },
    },
    apiUrl,
  );
}

describe('the same Geins read from two buyers at the same moment', () => {
  let geins: Awaited<ReturnType<typeof holdingServer>>;

  beforeEach(async () => {
    geins = await holdingServer();
  });

  afterEach(async () => {
    // Lets a read still waiting on a failed test settle before the socket closes.
    geins.answerAll();
    await geins.close();
  });

  it('sends a read per buyer, each answered with its own token', async () => {
    const { core } = storefrontAt(geins.url);
    const read = (userToken: string) =>
      core.graphql.query<{ probe: string }>({
        queryAsString: QUERY,
        variables: { channelId: '1|se' },
        userToken,
      });

    const a = read('A');
    const b = read('B');
    await geins.arrived(2);

    expect(geins.held.map((r) => r.auth).sort()).toEqual([
      'Bearer A',
      'Bearer B',
    ]);
    geins.answerAll();
    expect((await a).probe).toBe('Bearer A');
    expect((await b).probe).toBe('Bearer B');
  });

  it('sends crm.user.get per buyer, each answered with its own user', async () => {
    const { crm } = storefrontAt(geins.url);

    const a = crm.user.get('A');
    const b = crm.user.get('B');
    await geins.arrived(2);

    expect(geins.held.map((r) => r.auth).sort()).toEqual([
      'Bearer A',
      'Bearer B',
    ]);
    geins.answerAll();
    expect((await a)?.email).toBe('Bearer A');
    expect((await b)?.email).toBe('Bearer B');
  });

  it('still sends one read for two signed-out visitors', async () => {
    const { core } = storefrontAt(geins.url);
    const read = () =>
      core.graphql.query<{ probe: string }>({
        queryAsString: QUERY,
        variables: { channelId: '1|se' },
      });
    const answered = vi.fn();

    const a = read().then(answered);
    const b = read().then(answered);
    await geins.arrived(1);

    expect(geins.held).toHaveLength(1);
    expect(answered).not.toHaveBeenCalled();
    geins.answerAll();
    await Promise.all([a, b]);
    expect(answered.mock.calls.map(([data]) => data.probe)).toEqual([
      'none',
      'none',
    ]);
  });
});

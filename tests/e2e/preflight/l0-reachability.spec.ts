import { test, expect, type APIResponse } from '@playwright/test';
import { lookup } from 'node:dns/promises';
import { outOfScope } from '../helpers';
import { BASE_URL, REMOTE_TARGET, isLoopbackAddress } from '../target';

/**
 * Preflight L0. First that the target is this machine at all, then that it
 * answers. Any HTTP answer counts; what it says is for the layers above.
 */

const WINDOW_MS = 20_000;

/** What to do about a target that is not this machine, in this run's terms. */
function localityHint(host: string, addresses: string[]): string {
  const where =
    addresses.length > 0
      ? `resolves to ${addresses.join(', ')}`
      : 'does not resolve';
  const fix = host.endsWith('.litium.portal')
    ? 'Run `pnpm local:setup` — it installs the dnsmasq wildcard for ' +
      '*.litium.portal and writes the /etc/hosts line for the ' +
      'production-build target.'
    : `Add \`127.0.0.1 ${host}\` to /etc/hosts, or run \`pnpm local:setup\`, ` +
      'which writes that line for the configured target.';

  return (
    `"${host}" ${where}, not to this machine, so the run would test a ` +
    `deployed environment instead of the build under test. ${fix} ` +
    'To test a deployed environment on purpose, set E2E_REMOTE=1.'
  );
}

test('L0 target: the origin resolves to this machine', async () => {
  outOfScope(
    REMOTE_TARGET,
    'remote-target',
    'E2E_REMOTE=1: the target is a deployed environment on purpose',
  );

  // getaddrinfo, so /etc/hosts and the resolver count exactly as they will for
  // the browser. A name that resolves nowhere lands here as an empty list.
  const host = new URL(BASE_URL).hostname;
  const addresses = await lookup(host, { all: true })
    .then((entries) => entries.map((entry) => entry.address))
    .catch(() => [] as string[]);

  expect(
    addresses.length > 0 && addresses.every(isLoopbackAddress),
    localityHint(host, addresses),
  ).toBe(true);
});

/**
 * Polls for a short window so a server started just before the run (CI starts
 * the preview in its own step) does not fail on the first probe.
 */
test('L0 reachability: the origin answers', async ({ request }) => {
  const deadline = Date.now() + WINDOW_MS;
  let response: APIResponse | undefined;
  let lastError = '';

  while (!response && Date.now() < deadline) {
    try {
      response = await request.get('/', { maxRedirects: 0, timeout: 5_000 });
    } catch (error) {
      lastError = (error as Error).message.split('\n')[0] ?? String(error);
      await new Promise((r) => setTimeout(r, 1_000));
    }
  }

  expect(
    response,
    `${BASE_URL} did not answer within ${WINDOW_MS / 1000}s: ${lastError}`,
  ).toBeDefined();
});

import { test, expect, type APIResponse } from '@playwright/test';
import { lookup } from 'node:dns/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { outOfScope } from '../helpers';
import { BASE_URL, REMOTE_TARGET, isLoopbackAddress } from '../target';
import { unreachableHint, targetPort } from './unreachable-hint';

const execFileAsync = promisify(execFile);

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
  const fix = host.endsWith('.litium.test')
    ? 'Run `pnpm local:setup` — it installs the dnsmasq wildcard that sends ' +
      'all of *.litium.test to 127.0.0.1.'
    : `Point "${host}" at 127.0.0.1 with an /etc/hosts line, or target a ` +
      '`.litium.test` name, which the dnsmasq wildcard resolves and the ' +
      'server looks up under `.litium.store`.';

  return (
    `"${host}" ${where}, not to this machine, so the run would test a ` +
    `deployed environment instead of the build under test. ${fix} ` +
    'To test a deployed environment on purpose, set E2E_REMOTE=1.'
  );
}

/** Every address the target name resolves to, empty when it resolves nowhere. */
async function resolveTarget(host: string): Promise<string[]> {
  return lookup(host, { all: true })
    .then((entries) => entries.map((entry) => entry.address))
    .catch(() => [] as string[]);
}

/**
 * Whether a process holds the port. `undefined` rather than false when the
 * question cannot be answered — no `lsof` on the runner — so the hint says
 * nothing instead of something wrong.
 */
async function isPortHeld(port: string): Promise<boolean | undefined> {
  try {
    await execFileAsync('lsof', [`-iTCP:${port}`, '-sTCP:LISTEN', '-n', '-P']);
    return true;
  } catch (error) {
    // lsof exits non-zero with no output when nothing matches, which is an
    // answer; ENOENT means it is not installed, which is not.
    return (error as NodeJS.ErrnoException).code === 'ENOENT'
      ? undefined
      : false;
  }
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
  const addresses = await resolveTarget(host);

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

  // The two extra probes run only when there is a failure to explain: the
  // same timeout means "no server" or "server up, connection never arrives",
  // and the client cannot tell those apart on its own.
  let hint = '';
  if (!response) {
    const addresses = await resolveTarget(new URL(BASE_URL).hostname);
    hint = unreachableHint({
      baseUrl: BASE_URL,
      windowSeconds: WINDOW_MS / 1000,
      // `every` alone would call a name that resolves nowhere loopback.
      loopback: addresses.length > 0 && addresses.every(isLoopbackAddress),
      listening: await isPortHeld(targetPort(BASE_URL)),
      lastError,
    });
  }

  expect(response, hint).toBeDefined();
});

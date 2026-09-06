import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { isLoopbackAddress } from '../e2e/target-defaults.mjs';

/**
 * The two pieces of the e2e target module that decide something on their own,
 * rather than reading an environment variable straight through.
 *
 * `isLoopbackAddress` is what keeps a run honest: preflight L0 uses it to tell
 * "the build under test" from "a deployed environment".
 */

const MODULE = resolve(import.meta.dirname, '../e2e/target-defaults.mjs');

/**
 * The hostname the module prints, from a child process with an explicit
 * environment. The module reads the gitignored `.env` at import, so asserting
 * on it in-process would make this test depend on the machine it runs on —
 * a developer pointing `PLAYWRIGHT_BASE_URL` at a deployed environment would
 * fail `pnpm test` with nothing wrong in the repo. This is also exactly how
 * `infra/scripts/local-dev.sh` reads it.
 */
function printedHostname(overrides: Record<string, string> = {}): string {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.E2E_REMOTE;
  delete env.E2E_PROD;
  Object.assign(env, { PLAYWRIGHT_BASE_URL: '', ...overrides });

  return execFileSync(process.execPath, [MODULE], {
    encoding: 'utf8',
    env,
  }).trim();
}

describe('isLoopbackAddress', () => {
  it.each([
    '127.0.0.1',
    '127.0.1.1',
    '127.255.255.254',
    '::1',
    '0:0:0:0:0:0:0:1',
    '0000:0000:0000:0000:0000:0000:0000:0001',
    '::ffff:127.0.0.1',
    ' ::1 ',
    '::1%lo0',
  ])('accepts %s', (address) => {
    expect(isLoopbackAddress(address)).toBe(true);
  });

  it.each([
    '20.105.224.34',
    '128.0.0.1',
    '10.0.0.1',
    '192.168.1.10',
    '::2',
    '2001:db8::1',
    '',
    ' ',
  ])('rejects %s', (address) => {
    expect(isLoopbackAddress(address)).toBe(false);
  });
});

describe('target hostname', () => {
  it('is the committed local name, and the same one in every mode', () => {
    // One default, not one per mode: the hostname rewrite
    // (server/utils/lookup-hostname.ts) resolves it for the production build
    // too, so nothing on the machine has to be configured.
    expect(printedHostname()).toMatch(/\.litium\.portal$/);
    expect(printedHostname({ E2E_PROD: '1' })).toBe(printedHostname());
  });

  it('lets PLAYWRIGHT_BASE_URL override it', () => {
    expect(
      printedHostname({ PLAYWRIGHT_BASE_URL: 'https://elsewhere.example.com' }),
    ).toBe('elsewhere.example.com');
  });
});

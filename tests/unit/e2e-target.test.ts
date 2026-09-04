import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  BASE_URL,
  isLoopbackAddress,
  targetHostname,
} from '../e2e/target-defaults.mjs';

/**
 * The two pieces of the e2e target module that decide something on their own,
 * rather than reading an environment variable straight through.
 *
 * `isLoopbackAddress` is what keeps a run honest: preflight L0 uses it to tell
 * "the build under test" from "a deployed environment".
 */

const MODULE = resolve(import.meta.dirname, '../e2e/target-defaults.mjs');

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
    expect(targetHostname()).toMatch(/\.litium\.portal$/);
    expect(targetHostname()).toBe(new URL(BASE_URL).hostname);

    const perMode = ['', '1'].map((prod) =>
      execFileSync(process.execPath, [MODULE], {
        encoding: 'utf8',
        env: { ...process.env, E2E_PROD: prod, PLAYWRIGHT_BASE_URL: '' },
      }).trim(),
    );
    expect(perMode[0]).toBe(perMode[1]);
  });

  it('lets PLAYWRIGHT_BASE_URL override it', () => {
    // Run as a child process: infra/scripts/local-dev.sh reads the hostname
    // exactly this way, and the module resolves its target once at import.
    const printed = execFileSync(process.execPath, [MODULE], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: 'https://elsewhere.example.com:3000',
      },
    }).trim();

    expect(printed).toBe('elsewhere.example.com');
  });
});

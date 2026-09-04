import { describe, it, expect, afterEach } from 'vitest';
import {
  devTargetHostname,
  isLoopbackAddress,
  productionTargetHostname,
} from '../e2e/target-defaults.mjs';

/**
 * The two pieces of the e2e target module that decide something on their own,
 * rather than reading an environment variable straight through.
 *
 * `isLoopbackAddress` is what keeps a run honest: the production-build target
 * is the tenant's registered hostname, which resolves publicly, so preflight
 * L0 uses this to tell "the build under test" from "the deployed site".
 */

const originalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

afterEach(() => {
  if (originalBaseUrl === undefined) delete process.env.PLAYWRIGHT_BASE_URL;
  else process.env.PLAYWRIGHT_BASE_URL = originalBaseUrl;
});

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

describe('target hostnames', () => {
  it('names the committed tenant per mode', () => {
    delete process.env.PLAYWRIGHT_BASE_URL;

    // The dev server is reached under the wildcard suffix and the tenant is
    // looked up under its registered one; the production build has no rewrite.
    expect(devTargetHostname()).toMatch(/\.litium\.portal$/);
    expect(productionTargetHostname()).toMatch(/\.litium\.store$/);
    expect(devTargetHostname().split('.')[0]).toBe(
      productionTargetHostname().split('.')[0],
    );
  });

  it('lets PLAYWRIGHT_BASE_URL decide both', () => {
    process.env.PLAYWRIGHT_BASE_URL = 'https://elsewhere.example.com:3000';

    expect(productionTargetHostname()).toBe('elsewhere.example.com');
    expect(devTargetHostname()).toBe('elsewhere.example.com');
  });
});

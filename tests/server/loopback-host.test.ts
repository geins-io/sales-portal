import { describe, it, expect } from 'vitest';
import { isLoopbackHost } from '../../server/utils/loopback-host';

describe('server/utils/loopback-host', () => {
  it.each([
    'localhost',
    'localhost:3000',
    '127.0.0.1',
    '127.0.0.1:3000',
    'LOCALHOST',
    'LocalHost:3000',
  ])('names the server itself: %s', (host) => {
    expect(isLoopbackHost(host)).toBe(true);
  });

  // The IPv6 literal is why this runs on the raw Host header: the plugin's
  // `normalizeHostname` splits on ':' and would hand it '['.
  it.each(['[::1]', '[::1]:3000'])(
    'reads the address out of the brackets: %s',
    (host) => {
      expect(isLoopbackHost(host)).toBe(true);
    },
  );

  // Matching is textual, not an address comparison. No client writes the
  // expanded form in a Host header, and equating the two would mean parsing
  // IPv6 for a page only a developer sees.
  it('does not expand an abbreviated address', () => {
    expect(isLoopbackHost('[0:0:0:0:0:0:0:1]')).toBe(false);
  });

  it.each([
    'test.localhost',
    'localhost.example',
    'example.litium.test',
    '127.0.0.2',
    '127.0.0.1.example',
    '[::2]:3000',
    '',
  ])('leaves a tenant hostname alone: %s', (host) => {
    expect(isLoopbackHost(host)).toBe(false);
  });

  it('refuses a bracket that never closes rather than guessing', () => {
    expect(isLoopbackHost('[::1')).toBe(false);
  });
});

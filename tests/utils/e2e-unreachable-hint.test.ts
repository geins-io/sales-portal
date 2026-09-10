import { describe, it, expect } from 'vitest';
import {
  unreachableHint,
  targetPort,
  type UnreachableContext,
} from '../e2e/preflight/unreachable-hint';

/**
 * The decision inside preflight L0's failure message. The probes that feed it
 * live in the spec; only this part can run under vitest, and it is the part
 * that is easy to get wrong.
 */

const base: UnreachableContext = {
  baseUrl: 'http://example.litium.test:3000',
  windowSeconds: 20,
  loopback: true,
  listening: undefined,
  lastError: 'connect ETIMEDOUT',
};

describe('targetPort', () => {
  it('returns the explicit port', () => {
    expect(targetPort('http://example.litium.test:3000')).toBe('3000');
  });

  it('falls back to the port the scheme implies', () => {
    expect(targetPort('http://example.litium.test/')).toBe('80');
    expect(targetPort('https://example.litium.test/')).toBe('443');
  });
});

describe('unreachableHint', () => {
  it('always states the origin, the window and the last error', () => {
    const hint = unreachableHint(base);

    expect(hint).toContain('http://example.litium.test:3000');
    expect(hint).toContain('20s');
    expect(hint).toContain('connect ETIMEDOUT');
  });

  it('names pnpm local:stop when the server is up but unreachable', () => {
    const hint = unreachableHint({ ...base, listening: true });

    expect(hint).toContain('pnpm local:stop');
    expect(hint).toContain('port 3000');
  });

  it('says the server is not running when nothing holds the port', () => {
    const hint = unreachableHint({ ...base, listening: false });

    expect(hint).toContain('Nothing is listening on port 3000');
    expect(hint).not.toContain('pnpm local:stop');
  });

  it('adds nothing when it could not tell whether the port is held', () => {
    expect(unreachableHint(base)).toBe(
      unreachableHint({ ...base, listening: undefined }),
    );
    expect(unreachableHint(base)).not.toContain('pnpm local:stop');
    expect(unreachableHint(base)).not.toContain('Nothing is listening');
  });

  // A remote target that times out is not this machine's pf, whatever is
  // listening here: E2E_REMOTE=1 runs would otherwise be told to run
  // `pnpm local:stop` for a deployed environment's outage.
  it('suggests nothing local when the target is not this machine', () => {
    const hint = unreachableHint({
      ...base,
      baseUrl: 'https://example.litium.store',
      loopback: false,
      listening: true,
    });

    expect(hint).not.toContain('pnpm local:stop');
    expect(hint).not.toContain('Nothing is listening');
  });
});

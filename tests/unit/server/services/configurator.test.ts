import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAppError, ErrorCode } from '../../../../server/utils/errors';
import {
  buildConfiguratorContext,
  getConfiguratorBackend,
  resolveConfiguratorBackendName,
  type ConfiguratorBackend,
  type ConfiguratorContext,
} from '../../../../server/services/configurator';
import type { Configuration } from '../../../../shared/types/configurator';

// ---------------------------------------------------------------------------
// Stubs
//
// `createAppError` and `ErrorCode` are server auto-imports and resolve to
// globals here, so they are stubbed with the real implementations — the status
// codes below then come from the real table rather than from a hand-written map
// that could drift from it. `useRuntimeConfig` cannot be stubbed that way: it
// resolves to Nuxt's app implementation, which needs a Nuxt instance, which is
// why the read sits in its own module and is mocked.
// ---------------------------------------------------------------------------

const mockReadBackendValue = vi.fn();
const mockGetAuthCookies = vi.fn();

vi.mock('../../../../server/services/configurator-config', () => ({
  readConfiguratorBackendValue: (...args: unknown[]) =>
    mockReadBackendValue(...args),
}));

vi.stubGlobal('createAppError', createAppError);
vi.stubGlobal('ErrorCode', ErrorCode);
vi.stubGlobal('getAuthCookies', (...args: unknown[]) =>
  mockGetAuthCookies(...args),
);

const EVENT = {} as Parameters<typeof getConfiguratorBackend>[0];
const CTX: ConfiguratorContext = { hostname: 'tenant.example.com' };

beforeEach(() => {
  mockReadBackendValue.mockReset();
  mockGetAuthCookies.mockReset();
  mockGetAuthCookies.mockReturnValue({});
});

function withBackend(value: unknown) {
  mockReadBackendValue.mockReturnValue(value);
  return getConfiguratorBackend(EVENT);
}

/** Every method of the interface, as a thunk, so one loop can check them all. */
function allCalls(
  backend: ConfiguratorBackend,
): [string, () => Promise<unknown>][] {
  return [
    ['create', () => backend.create({ productId: 'p1', quantity: 1 }, CTX)],
    ['get', () => backend.get('c1', CTX)],
    [
      'applyChanges',
      () =>
        backend.applyChanges('c1', [{ type: 'quantity', quantity: 2 }], CTX),
    ],
    ['renew', () => backend.renew('c1', CTX)],
    ['release', () => backend.release('c1', CTX)],
    ['commit', () => backend.commit('c1', CTX)],
  ];
}

async function statusOf(
  call: () => Promise<unknown>,
): Promise<number | undefined> {
  try {
    await call();
    return undefined;
  } catch (error) {
    return (error as { statusCode?: number }).statusCode;
  }
}

// ---------------------------------------------------------------------------
// The parser
//
// A GitHub variable that does not exist arrives as an empty string, and an
// empty NUXT_* value overrides the Nuxt default. Anything but the two known
// names is therefore `off`.
// ---------------------------------------------------------------------------

describe('resolveConfiguratorBackendName', () => {
  it('accepts the two implemented names', () => {
    expect(resolveConfiguratorBackendName('fixture')).toBe('fixture');
    expect(resolveConfiguratorBackendName('sdk')).toBe('sdk');
  });

  it('reads off as off', () => {
    expect(resolveConfiguratorBackendName('off')).toBe('off');
  });

  it.each([
    ['an empty string', ''],
    ['an unknown value', 'nonsense'],
    ['undefined', undefined],
    ['null', null],
    ['a non-string', 42],
    ['the wrong case', 'Fixture'],
    ['a padded value', ' fixture '],
  ])('reads %s as off', (_label, value) => {
    expect(resolveConfiguratorBackendName(value)).toBe('off');
  });
});

// ---------------------------------------------------------------------------
// The switch
// ---------------------------------------------------------------------------

describe('getConfiguratorBackend', () => {
  describe.each([
    ['off', 'off'],
    ['an empty string', ''],
    ['an unknown value', 'nonsense'],
  ])('with the key set to %s', (_label, value) => {
    it('answers 404 from every method', async () => {
      const backend = withBackend(value);
      for (const [name, call] of allCalls(backend)) {
        expect(await statusOf(call), name).toBe(404);
      }
    });
  });

  it('answers 404 from every method when the key is absent', async () => {
    const backend = withBackend(undefined);
    for (const [name, call] of allCalls(backend)) {
      expect(await statusOf(call), name).toBe(404);
    }
  });

  it('answers 501 from every method with the key set to sdk', async () => {
    const backend = withBackend('sdk');
    for (const [name, call] of allCalls(backend)) {
      expect(await statusOf(call), name).toBe(501);
    }
  });

  describe('with the key set to fixture', () => {
    it('creates a configuration document', async () => {
      const backend = withBackend('fixture');
      const configuration: Configuration = await backend.create(
        { productId: 'p1', quantity: 2 },
        CTX,
      );

      expect(configuration.configurationId).toBeTruthy();
      expect(configuration.productId).toBe('p1');
      expect(configuration.quantity).toBe(2);
      expect(Date.parse(configuration.expiresAt)).toBeGreaterThan(Date.now());

      // The stub's minimum: one section, one variable, one option group with
      // one option carrying its embedded product.
      expect(configuration.sections).toHaveLength(1);
      const section = configuration.sections[0]!;
      expect(section.variables).toHaveLength(1);
      expect(section.optionGroups).toHaveLength(1);
      const group = section.optionGroups[0]!;
      expect(group.options).toHaveLength(1);
      expect(group.options[0]!.product.productId).toBeGreaterThan(0);
    });

    it('answers 404 from the methods the stub does not implement yet', async () => {
      const backend = withBackend('fixture');
      for (const [name, call] of allCalls(backend)) {
        if (name === 'create') continue;
        expect(await statusOf(call), name).toBe(404);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// The context handed across the seam
// ---------------------------------------------------------------------------

describe('buildConfiguratorContext', () => {
  function eventWith(hostname?: string) {
    return { context: hostname ? { tenant: { hostname } } : {} } as Parameters<
      typeof buildConfiguratorContext
    >[0];
  }

  it('carries the tenant hostname', () => {
    expect(buildConfiguratorContext(eventWith('tenant.example.com'))).toEqual({
      hostname: 'tenant.example.com',
    });
  });

  it('carries the auth token when the request has one', () => {
    mockGetAuthCookies.mockReturnValue({ authToken: 'token-1' });
    expect(buildConfiguratorContext(eventWith('tenant.example.com'))).toEqual({
      hostname: 'tenant.example.com',
      userToken: 'token-1',
    });
  });

  it('leaves the token out rather than passing an empty one', () => {
    mockGetAuthCookies.mockReturnValue({ authToken: '' });
    const ctx = buildConfiguratorContext(eventWith('tenant.example.com'));
    expect(ctx.userToken).toBeUndefined();
    expect('userToken' in ctx).toBe(false);
  });

  it('falls back to an empty hostname when no tenant resolved', () => {
    expect(buildConfiguratorContext(eventWith()).hostname).toBe('');
  });
});

// ---------------------------------------------------------------------------
// The two error codes the seam needs
// ---------------------------------------------------------------------------

describe('error codes added for the configurator', () => {
  it('maps GONE to 410', () => {
    const error = createAppError(ErrorCode.GONE);
    expect(error.statusCode).toBe(410);
    expect(error.statusMessage).toBeTruthy();
  });

  it('maps NOT_IMPLEMENTED to 501', () => {
    const error = createAppError(ErrorCode.NOT_IMPLEMENTED);
    expect(error.statusCode).toBe(501);
    expect(error.statusMessage).toBeTruthy();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAppError, ErrorCode } from '../../../../server/utils/errors';
import {
  buildConfiguratorContext,
  buildConfiguratorRequestContext,
  getConfiguratorBackend,
  isConfigurableProduct,
  MERCHANT_API_DEFAULT_URL,
  resolveConfiguratorBackendName,
  resolveMerchantApiUrl,
  type ConfiguratorBackend,
  type ConfiguratorContext,
} from '../../../../server/services/configurator';
import type { Configuration } from '../../../../shared/types/configurator';
import { fixtureConfiguratorBackend } from '../../../../server/services/configurator-fixture';
import {
  ARBETSBORD_PRO_GEINS_ID,
  ARBETSBORD_PRO_ID,
} from '../../../../server/services/configurator-fixture/seed';

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
const mockReadMerchantApiUrl = vi.fn();
const mockGetAuthCookies = vi.fn();
const mockGetTenantSDK = vi.fn();
const mockGetRequestChannelVariables = vi.fn();

vi.mock('../../../../server/services/configurator-config', () => ({
  readConfiguratorBackendValue: (...args: unknown[]) =>
    mockReadBackendValue(...args),
  readConfiguratorMerchantApiUrl: (...args: unknown[]) =>
    mockReadMerchantApiUrl(...args),
}));

vi.mock('../../../../server/services/_sdk', () => ({
  getTenantSDK: (...args: unknown[]) => mockGetTenantSDK(...args),
  getRequestChannelVariables: (...args: unknown[]) =>
    mockGetRequestChannelVariables(...args),
}));

vi.stubGlobal('createAppError', createAppError);
vi.stubGlobal('ErrorCode', ErrorCode);
vi.stubGlobal('getAuthCookies', (...args: unknown[]) =>
  mockGetAuthCookies(...args),
);
vi.stubGlobal(
  'getSessionToken',
  (...args: unknown[]) =>
    (mockGetAuthCookies(...args) as { authToken?: string } | undefined)
      ?.authToken,
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
  it('accepts the implemented names', () => {
    expect(resolveConfiguratorBackendName('fixture')).toBe('fixture');
    expect(resolveConfiguratorBackendName('merchant-api')).toBe('merchant-api');
    expect(resolveConfiguratorBackendName('composite')).toBe('composite');
  });

  it('reads the retired sdk name as off', () => {
    expect(resolveConfiguratorBackendName('sdk')).toBe('off');
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

describe('resolveMerchantApiUrl', () => {
  it('takes a set URL as it is', () => {
    expect(resolveMerchantApiUrl('https://cpq.example.test/graphql')).toBe(
      'https://cpq.example.test/graphql',
    );
  });

  it.each([
    ['an empty string', ''],
    ['undefined', undefined],
    ['null', null],
    ['a non-string', 42],
  ])('reads %s as the ordinary merchant-api endpoint', (_label, value) => {
    expect(resolveMerchantApiUrl(value)).toBe(MERCHANT_API_DEFAULT_URL);
  });

  it('defaults to the endpoint the SDK itself talks to', () => {
    expect(MERCHANT_API_DEFAULT_URL).toBe(
      'https://merchantapi.geins.io/graphql',
    );
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

  it('answers 404 from every method with the retired key sdk', async () => {
    const backend = withBackend('sdk');
    for (const [name, call] of allCalls(backend)) {
      expect(await statusOf(call), name).toBe(404);
    }
  });

  it.each(['merchant-api', 'composite'])(
    'answers 500 on %s when the context carries no merchant-api target',
    async (value) => {
      // Only the product route builds the narrow context, and it never
      // creates; reaching the real backend without a target is a wiring bug.
      const backend = withBackend(value);
      expect(
        await statusOf(() =>
          backend.create({ productId: '1359', quantity: 1 }, CTX),
        ),
      ).toBe(500);
      expect(await statusOf(() => backend.get('c1', CTX))).toBe(500);
    },
  );

  describe('with the key set to fixture', () => {
    it('returns a configuration for the requested product', async () => {
      const backend = withBackend('fixture');
      const configuration: Configuration = await backend.create(
        { productId: ARBETSBORD_PRO_GEINS_ID, quantity: 2 },
        CTX,
      );

      // What the seam owes its callers: a live document for the product that
      // was asked for. Its shape belongs to the fixture engine's own tests.
      //
      // Asked for by the Geins product id, answered with a document carrying
      // the provider's part id: the translation the backend owes the portal.
      expect(configuration.configurationId).toBeTruthy();
      expect(configuration.articleNumber).toBe(ARBETSBORD_PRO_ID);
      expect(configuration.quantity).toBe(2);
      expect(Date.parse(configuration.expiresAt)).toBeGreaterThan(Date.now());
      expect(configuration.sections.length).toBeGreaterThan(0);

      await backend.release(configuration.configurationId, CTX);
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
// The context a configuration route hands across the seam
//
// Everything the real backend needs from the request, read here so no backend
// reads the event itself.
// ---------------------------------------------------------------------------

describe('buildConfiguratorRequestContext', () => {
  const SDK = { sdk: true };
  const CHANNEL = { channelId: '1|se', languageId: 'sv-SE', marketId: 'se' };
  const TARGET_URL = 'https://cpq.example.test/graphql';

  function eventWith(tenant?: Record<string, unknown>) {
    return { context: tenant ? { tenant } : {} } as unknown as Parameters<
      typeof buildConfiguratorRequestContext
    >[0];
  }

  const TENANT = {
    hostname: 'tenant.example.com',
    config: { geinsSettings: { apiKey: 'key-1' } },
  };

  beforeEach(() => {
    mockReadMerchantApiUrl.mockReset();
    mockReadMerchantApiUrl.mockReturnValue(TARGET_URL);
    mockGetTenantSDK.mockReset();
    mockGetTenantSDK.mockResolvedValue(SDK);
    mockGetRequestChannelVariables.mockReset();
    mockGetRequestChannelVariables.mockReturnValue(CHANNEL);
  });

  it('carries the narrow context plus the merchant-api target', async () => {
    mockGetAuthCookies.mockReturnValue({ authToken: 'token-1' });
    const event = eventWith(TENANT);

    expect(await buildConfiguratorRequestContext(event)).toEqual({
      hostname: 'tenant.example.com',
      userToken: 'token-1',
      merchantApi: { url: TARGET_URL, apiKey: 'key-1', ...CHANNEL },
    });
    expect(mockReadMerchantApiUrl).toHaveBeenCalledWith(event);
    expect(mockGetRequestChannelVariables).toHaveBeenCalledWith(SDK, event);
  });

  it("uses the tenant's own API key, with no secret of its own", async () => {
    const ctx = await buildConfiguratorRequestContext(
      eventWith({
        ...TENANT,
        config: { geinsSettings: { apiKey: 'another-key' } },
      }),
    );
    expect(ctx.merchantApi?.apiKey).toBe('another-key');
  });

  it('falls back to the ordinary endpoint when the key is empty', async () => {
    mockReadMerchantApiUrl.mockReturnValue('');
    const ctx = await buildConfiguratorRequestContext(eventWith(TENANT));
    expect(ctx.merchantApi?.url).toBe(MERCHANT_API_DEFAULT_URL);
  });

  it('carries an empty key rather than failing when the tenant has none', async () => {
    const ctx = await buildConfiguratorRequestContext(
      eventWith({ hostname: 'tenant.example.com' }),
    );
    expect(ctx.merchantApi?.apiKey).toBe('');
  });

  it('carries an empty key when the config has no Geins settings', async () => {
    const ctx = await buildConfiguratorRequestContext(
      eventWith({ hostname: 'tenant.example.com', config: {} }),
    );
    expect(ctx.merchantApi?.apiKey).toBe('');
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

// ---------------------------------------------------------------------------
// Is this product configurable?
//
// The question the product route asks before it decides which page a product
// gets. It is asked of the seam, not of the fixture, so the day the merchant
// API carries the field the answer moves here and the route does not change.
//
// It answers, it never throws: a product is being described, not configured.
// ---------------------------------------------------------------------------

describe('isConfigurableProduct', () => {
  // A real-shaped event: the seam builds the context from it, exactly as it
  // does for every other call.
  const EVENT_WITH_TENANT = {
    context: { tenant: { hostname: 'tenant.example.com' } },
  } as unknown as Parameters<typeof isConfigurableProduct>[0];

  // Measured 2026-09-24: an ordinary product and the seeds' own catalogue
  // products answer `"product"`; the Monitor sync stamps `"configurable"`.
  const ORDINARY_TYPE = 'product';
  const CONFIGURABLE_TYPE = 'configurable';

  function answerWith(
    value: unknown,
    productId: string,
    type?: string | null,
  ): boolean {
    mockReadBackendValue.mockReturnValue(value);
    return isConfigurableProduct(EVENT_WITH_TENANT, { productId, type });
  }

  it.each([
    ['its measured ordinary type', ORDINARY_TYPE],
    ['the configurable type', CONFIGURABLE_TYPE],
    ['no type', undefined],
  ])(
    'says yes on the fixture backend for a product a seed stands for, with %s',
    (_label, type) => {
      expect(answerWith('fixture', ARBETSBORD_PRO_GEINS_ID, type)).toBe(true);
    },
  );

  it('says no on the fixture backend for a product no seed stands for', () => {
    expect(answerWith('fixture', '999999', ORDINARY_TYPE)).toBe(false);
  });

  it('says no on the fixture backend for a configurable type no seed stands for', () => {
    // The fixture can only configure its seeds; a Monitor-typed product is the
    // real backend's to answer.
    expect(answerWith('fixture', '1359', CONFIGURABLE_TYPE)).toBe(false);
  });

  it("says no for the provider's own part id, which is not a catalogue product", () => {
    expect(answerWith('fixture', ARBETSBORD_PRO_ID, ORDINARY_TYPE)).toBe(false);
  });

  it('says yes on the merchant-api backend for the configurable type only', () => {
    expect(answerWith('merchant-api', '1359', CONFIGURABLE_TYPE)).toBe(true);
    expect(answerWith('merchant-api', '1359', ORDINARY_TYPE)).toBe(false);
    expect(answerWith('merchant-api', ARBETSBORD_PRO_GEINS_ID, undefined)).toBe(
      false,
    );
  });

  it('says yes on the composite backend for a seed and for the configurable type', () => {
    expect(
      answerWith('composite', ARBETSBORD_PRO_GEINS_ID, ORDINARY_TYPE),
    ).toBe(true);
    expect(answerWith('composite', '1359', CONFIGURABLE_TYPE)).toBe(true);
    expect(answerWith('composite', '1359', ORDINARY_TYPE)).toBe(false);
  });

  it.each([
    ['off', 'off'],
    ['sdk', 'sdk'],
    ['an unknown value', 'nonsense'],
    ['the key absent', undefined],
  ])(
    'says no with the backend %s, even for a configurable type',
    (_label, value) => {
      // Production runs `off`: a Monitor-typed product must not be sent to a
      // configurator page that would fail at create.
      expect(answerWith(value, '1359', CONFIGURABLE_TYPE)).toBe(false);
      expect(answerWith(value, ARBETSBORD_PRO_GEINS_ID, ORDINARY_TYPE)).toBe(
        false,
      );
    },
  );

  it('passes the product through to the backend unchanged', () => {
    mockReadBackendValue.mockReturnValue('fixture');
    const product = { productId: '1359', type: CONFIGURABLE_TYPE };
    const spy = vi.spyOn(fixtureConfiguratorBackend, 'isConfigurable');

    isConfigurableProduct(EVENT_WITH_TENANT, product);

    expect(spy).toHaveBeenCalledWith(product, {
      hostname: 'tenant.example.com',
    });
    spy.mockRestore();
  });

  it('answers rather than throws on a backend that rejects every verb', () => {
    expect(() =>
      answerWith('off', ARBETSBORD_PRO_GEINS_ID, ORDINARY_TYPE),
    ).not.toThrow();
  });

  it('builds the context from the event, tenant or no tenant', () => {
    // The context is built the same way as for every other call, so a request
    // that resolved no tenant must answer rather than throw on the way in.
    mockReadBackendValue.mockReturnValue('fixture');
    const withoutTenant = { context: {} } as Parameters<
      typeof isConfigurableProduct
    >[0];

    expect(
      isConfigurableProduct(withoutTenant, {
        productId: ARBETSBORD_PRO_GEINS_ID,
        type: ORDINARY_TYPE,
      }),
    ).toBe(true);
  });
});

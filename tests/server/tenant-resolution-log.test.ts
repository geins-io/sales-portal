import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  resolveTenant,
  clearNegativeCache,
  describeTransportError,
  formatTenantResolution,
} from '../../server/utils/tenant';

// Same auto-import shims as tests/server/tenant.test.ts: the tenant utils
// reach useRuntimeConfig/useStorage through Nitro's transformer, which the
// node tier does not run. vi.hoisted so the refs exist when the hoisted
// vi.mock factories run.
const {
  mockLoggerWarn,
  mockLoggerDebug,
  mockIsDevMode,
  mockUseRuntimeConfig,
  mockUseStorage,
} = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
  mockLoggerDebug: vi.fn(),
  mockIsDevMode: vi.fn(() => true),
  mockUseRuntimeConfig: vi.fn(() => ({
    geins: { tenantApiUrl: 'https://merchant.example/store-settings' },
  })),
  mockUseStorage: vi.fn(() => ({
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    hasItem: vi.fn(() => Promise.resolve(false)),
  })),
}));
vi.mock('#imports', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useRuntimeConfig: mockUseRuntimeConfig,
    useStorage: mockUseStorage,
  };
});
vi.mock('#app/nuxt', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useRuntimeConfig: mockUseRuntimeConfig };
});
vi.mock('nitropack/runtime/internal/config', async (importOriginal) => {
  const actual = (await importOriginal().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  return { ...actual, useRuntimeConfig: mockUseRuntimeConfig };
});
vi.mock('nitropack/runtime/internal/storage', async (importOriginal) => {
  const actual = (await importOriginal().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  return { ...actual, useStorage: mockUseStorage };
});
vi.mock('../../server/utils/logger', () => ({
  logger: {
    warn: mockLoggerWarn,
    debug: mockLoggerDebug,
    error: vi.fn(),
    info: vi.fn(),
  },
}));
vi.mock('../../server/utils/dev-mode', () => ({
  isDevMode: mockIsDevMode,
}));
// useStorage is a Nitro auto-import global, not an `#imports` member.
vi.stubGlobal('useStorage', mockUseStorage);

// --- Helpers -------------------------------------------------------------

const API_URL = 'https://merchant.example/store-settings';

function rawApiPayload(tenantId: string, hostname: string) {
  return {
    tenantId,
    isActive: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    geinsSettings: {
      defaultHostName: hostname,
      additionalHostNames: [],
      apiKey: 'E0EB51F2-B663-457F-A7F9-A75693FD8469',
      accountName: tenantId,
      channelId: '1|se',
      defaultLocale: 'sv-SE',
      defaultMarket: 'se',
      locales: ['sv-SE'],
      markets: ['se'],
    },
    appSettings: {
      mode: 'commerce',
      theme: {
        colors: {
          primary: 'oklch(0.5 0.1 200)',
          primaryForeground: 'oklch(0.9 0 0)',
          secondary: 'oklch(0.8 0 0)',
          secondaryForeground: 'oklch(0.2 0 0)',
          background: 'oklch(1 0 0)',
          foreground: 'oklch(0.1 0 0)',
        },
      },
      branding: { name: 'Brand', watermark: 'full' },
      features: {},
    },
  };
}

function httpResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () =>
      body === undefined
        ? Promise.reject(new SyntaxError('Unexpected end of JSON input'))
        : Promise.resolve(body),
  } as unknown as Response;
}

/** What Node's fetch throws when the connection is refused: TypeError with the code on `cause`. */
function connectionRefused(): Error {
  const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1'), {
    code: 'ECONNREFUSED',
  });
  return new TypeError('fetch failed', { cause });
}

function stubFetch(impl: (url: string) => Promise<Response>) {
  const spy = vi.fn(impl);
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

function makeEvent(): { context: Record<string, unknown> } {
  return { context: {} };
}

function warnLinesFor(hostname: string): string[] {
  return mockLoggerWarn.mock.calls
    .map(([msg]) => msg as string)
    .filter((msg) => msg.includes(`host=${hostname} `));
}

function debugLinesFor(hostname: string): string[] {
  return mockLoggerDebug.mock.calls
    .map(([msg]) => msg as string)
    .filter((msg) => msg.includes(`host=${hostname} `));
}

// --- Tests ---------------------------------------------------------------

// Sequential: the tests swap the global fetch and flip the dev-mode mock,
// which the file-level concurrency of the node tier would otherwise race.
describe.sequential('resolveTenant resolution log', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockLoggerWarn.mockClear();
    mockLoggerDebug.mockClear();
    mockIsDevMode.mockReturnValue(true);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('unknown hostname: the merchant API answered 404 → outcome=unknown-tenant', async () => {
    const host = 'unknown.example';
    stubFetch(async () => httpResponse(404));
    const event = makeEvent();

    const result = await resolveTenant(
      host,
      event as unknown as Parameters<typeof resolveTenant>[1],
    );
    clearNegativeCache(host);

    expect(result).toBeNull();
    const lines = warnLinesFor(host);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      `[tenant] resolve host=${host} kv=miss api=GET ${API_URL}?hostname=${host} → 404 outcome=unknown-tenant`,
    );
    // The same line is left on the event for the 404 page.
    expect(event.context.tenantResolution).toBe(lines[0]);
    expect(mockLoggerDebug).not.toHaveBeenCalled();
  });

  it('merchant API unreachable: fetch threw → outcome=transport-failure, naming the error code', async () => {
    const host = 'unreachable.example';
    stubFetch(async () => {
      throw connectionRefused();
    });
    const event = makeEvent();

    const result = await resolveTenant(
      host,
      event as unknown as Parameters<typeof resolveTenant>[1],
    );
    clearNegativeCache(host);

    expect(result).toBeNull();
    const lines = warnLinesFor(host);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      `[tenant] resolve host=${host} kv=miss api=GET ${API_URL}?hostname=${host} → ECONNREFUSED (connect ECONNREFUSED 127.0.0.1:1) outcome=transport-failure`,
    );
    expect(event.context.tenantResolution).toBe(lines[0]);
  });

  it('the two failure lines differ in the first token after outcome=', async () => {
    const unknownHost = 'a-unknown.example';
    const downHost = 'a-down.example';

    stubFetch(async () => httpResponse(404));
    await resolveTenant(unknownHost);
    stubFetch(async () => {
      throw connectionRefused();
    });
    await resolveTenant(downHost);
    clearNegativeCache(unknownHost);
    clearNegativeCache(downHost);

    const token = (line: string) => /outcome=(\S+)/.exec(line)?.[1];
    expect(token(warnLinesFor(unknownHost)[0]!)).toBe('unknown-tenant');
    expect(token(warnLinesFor(downHost)[0]!)).toBe('transport-failure');
  });

  it('a non-404 error status from the merchant API is a transport failure, not an unknown tenant', async () => {
    const host = 'upstream-500.example';
    stubFetch(async () => httpResponse(502));

    await resolveTenant(host);
    clearNegativeCache(host);

    expect(warnLinesFor(host)[0]).toContain('→ 502 outcome=transport-failure');
  });

  it('a later lookup within the negative-cache window says what it repeats', async () => {
    const host = 'cached.example';
    const fetchSpy = stubFetch(async () => {
      throw connectionRefused();
    });

    await resolveTenant(host);
    await resolveTenant(host);
    clearNegativeCache(host);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const lines = warnLinesFor(host);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(
      new RegExp(
        `^\\[tenant\\] resolve host=${host} kv=skipped api=skipped outcome=negative-cache \\(transport-failure, \\d+s ago\\)$`,
      ),
    );
  });

  it('a resolved lookup logs at debug, not warn', async () => {
    const host = 'registered.example';
    stubFetch(async () => httpResponse(200, rawApiPayload('registered', host)));

    const result = await resolveTenant(host);

    expect(result?.tenantId).toBe('registered');
    expect(warnLinesFor(host)).toHaveLength(0);
    const lines = debugLinesFor(host);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      `[tenant] resolve host=${host} kv=miss api=GET ${API_URL}?hostname=${host} → 200 outcome=resolved tenant=registered`,
    );
  });

  it('a KV hit logs kv=hit with the merchant API skipped', async () => {
    const host = 'kv-hit.example';
    const config = {
      tenantId: 'kv-tenant',
      hostname: host,
      isActive: true,
      geinsSettings: { additionalHostNames: [] },
    };
    // useStorage is called once per KV step; keep the seeded store for all of them.
    mockUseStorage.mockReturnValue({
      getItem: vi.fn((key: string) =>
        Promise.resolve(key.endsWith(`:${host}`) ? 'kv-tenant' : config),
      ),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      hasItem: vi.fn(() => Promise.resolve(false)),
    } as unknown as ReturnType<typeof mockUseStorage>);
    const fetchSpy = stubFetch(async () => httpResponse(404));

    const result = await resolveTenant(host);
    mockUseStorage.mockReset();
    mockUseStorage.mockImplementation(() => ({
      getItem: vi.fn(() => Promise.resolve(null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      hasItem: vi.fn(() => Promise.resolve(false)),
    }));

    expect(result).not.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(debugLinesFor(host)[0]).toBe(
      `[tenant] resolve host=${host} kv=hit api=skipped outcome=resolved tenant=kv-tenant`,
    );
  });

  it('production build: nothing is logged and nothing is left on the event', async () => {
    mockIsDevMode.mockReturnValue(false);
    const host = 'prod-unknown.example';
    stubFetch(async () => httpResponse(404));
    const event = makeEvent();

    const result = await resolveTenant(
      host,
      event as unknown as Parameters<typeof resolveTenant>[1],
    );
    clearNegativeCache(host);

    expect(result).toBeNull();
    expect(mockLoggerWarn).not.toHaveBeenCalled();
    expect(mockLoggerDebug).not.toHaveBeenCalled();
    expect(event.context.tenantResolution).toBeUndefined();
  });
});

describe('describeTransportError', () => {
  it('prefers the code undici puts on cause, followed by its message', () => {
    expect(describeTransportError(connectionRefused())).toBe(
      'ECONNREFUSED (connect ECONNREFUSED 127.0.0.1:1)',
    );
  });

  it('falls back to the error name for a timeout', () => {
    const err = new DOMException('The operation was aborted', 'TimeoutError');
    expect(describeTransportError(err)).toBe(
      'TimeoutError (The operation was aborted)',
    );
  });

  it('does not repeat a message that equals the label', () => {
    const err = new Error('ENOTFOUND');
    err.name = 'ENOTFOUND';
    expect(describeTransportError(err)).toBe('ENOTFOUND');
  });
});

describe('formatTenantResolution', () => {
  it('keeps the field order constant when the merchant API was not called', () => {
    expect(
      formatTenantResolution({
        hostname: 'x.example',
        kv: 'skipped',
        outcome: 'negative-cache',
        detail: 'unknown-tenant, 12s ago',
      }),
    ).toBe(
      '[tenant] resolve host=x.example kv=skipped api=skipped outcome=negative-cache (unknown-tenant, 12s ago)',
    );
  });
});

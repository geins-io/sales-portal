import { describe, expect, it, vi } from 'vitest';
import type { H3Event } from 'h3';
import {
  createAppError,
  ErrorCode,
  withErrorHandling,
} from '../../../../../server/utils/errors';
import type {
  ConfiguratorBackend,
  ConfiguratorContext,
} from '../../../../../server/services/configurator';

// ---------------------------------------------------------------------------
// What the six lifecycle routes are tested against.
//
// The backend and the tenant's feature map are mocked; everything else is the
// real implementation, the access rule included — `canAccessFeatureServer` runs
// for real over the features returned here, so a rule these tests pass is the
// rule production evaluates. `createAppError` and `withErrorHandling` are the
// real ones too, so the status codes below come from the error table rather
// than from a hand-written map that could drift from it, and the errors the
// mocked backend throws are the same `H3Error` class `withErrorHandling`
// re-throws, which a second copy of h3 would not be.
// ---------------------------------------------------------------------------

export type RouteHandler = (event: H3Event) => Promise<unknown>;

export const CTX: ConfiguratorContext = { hostname: 'tenant.example.com' };

export const backend: Record<
  keyof ConfiguratorBackend,
  ReturnType<typeof vi.fn>
> = {
  create: vi.fn(),
  get: vi.fn(),
  applyChanges: vi.fn(),
  renew: vi.fn(),
  release: vi.fn(),
  commit: vi.fn(),
};

export const getFeatures = vi.fn();
export const getConfiguratorBackend = vi.fn();
export const buildConfiguratorContext = vi.fn();

vi.mock('../../../../../server/services/configurator', () => ({
  getConfiguratorBackend: (...args: unknown[]) =>
    getConfiguratorBackend(...args),
  buildConfiguratorContext: (...args: unknown[]) =>
    buildConfiguratorContext(...args),
}));

vi.mock('../../../../../server/services/tenant-config', () => ({
  getFeatures: (...args: unknown[]) => getFeatures(...args),
}));

/** The tenant's `features.configurator`, as the merchant admin would set it. */
export function configuratorFeature(
  feature: { enabled: boolean; access?: 'all' | 'authenticated' } | undefined,
): void {
  getFeatures.mockResolvedValue(feature ? { configurator: feature } : {});
}

// ---------------------------------------------------------------------------
// The event a route sees
// ---------------------------------------------------------------------------

interface RouteEvent {
  context: { tenant?: { hostname: string; config?: { mode?: string } } };
  params: Record<string, string>;
  headers: Record<string, string>;
  body?: unknown;
  authToken?: string;
}

function asRouteEvent(event: H3Event): RouteEvent {
  return event as unknown as RouteEvent;
}

export function makeEvent(
  init: {
    id?: string;
    body?: unknown;
    mode?: 'commerce' | 'catalog';
    authenticated?: boolean;
    /** A tenant resolved without a config, as an unconfigured host is. */
    withoutConfig?: boolean;
    /** No tenant on the event at all. */
    withoutTenant?: boolean;
  } = {},
): H3Event {
  const tenant = {
    hostname: CTX.hostname,
    ...(init.withoutConfig
      ? {}
      : { config: { mode: init.mode ?? 'commerce' } }),
  };
  const event: RouteEvent = {
    context: init.withoutTenant ? {} : { tenant },
    params: init.id === undefined ? {} : { id: init.id },
    headers: {},
    body: init.body,
    ...(init.authenticated ? { authToken: 'a-user-token' } : {}),
  };
  return event as unknown as H3Event;
}

export function headersOf(event: H3Event): Record<string, string> {
  return asRouteEvent(event).headers;
}

// ---------------------------------------------------------------------------
// Nitro auto-imports
// ---------------------------------------------------------------------------

/** Records every body read, so "the body was never read" can be asserted. */
export const bodyReads = vi.fn();

vi.stubGlobal('defineEventHandler', (fn: RouteHandler) => fn);
vi.stubGlobal('createAppError', createAppError);
vi.stubGlobal('ErrorCode', ErrorCode);
/** Every context `withErrorHandling` was given, so the operation name a
 * failure is logged under can be asserted. */
export const errorContexts: unknown[] = [];

vi.stubGlobal(
  'withErrorHandling',
  (handler: () => Promise<unknown>, context: unknown) => {
    errorContexts.push(context);
    return withErrorHandling(handler, context as { operation?: string });
  },
);
vi.stubGlobal(
  'createError',
  ({
    statusCode,
    statusMessage,
  }: {
    statusCode: number;
    statusMessage?: string;
  }) =>
    Object.assign(new Error(statusMessage ?? String(statusCode)), {
      statusCode,
    }),
);
vi.stubGlobal('getAuthCookies', (event: H3Event) => ({
  authToken: asRouteEvent(event).authToken,
  refreshToken: undefined,
}));
vi.stubGlobal(
  'setResponseHeader',
  (event: H3Event, name: string, value: string) => {
    asRouteEvent(event).headers[name] = value;
  },
);
vi.stubGlobal(
  'getRouterParam',
  (event: H3Event, name: string) => asRouteEvent(event).params[name],
);
vi.stubGlobal(
  'readValidatedBody',
  async (event: H3Event, validate: (raw: unknown) => unknown) => {
    bodyReads(event);
    try {
      return await validate(asRouteEvent(event).body);
    } catch (error) {
      // h3's own `createValidationError` answers a throwing validator with 400
      // and the message "Validation Error". Reproduced through the repo's
      // helper so the error is the same class the real one would be.
      throw createAppError(
        ErrorCode.BAD_REQUEST,
        `Validation Error: ${(error as Error).message}`,
      );
    }
  },
);

// ---------------------------------------------------------------------------
// Errors the engine raises, exactly as the fixture raises them
// ---------------------------------------------------------------------------

export const unknownConfiguration = () =>
  createAppError(ErrorCode.NOT_FOUND, 'No such configuration');

export const expiredConfiguration = () =>
  createAppError(ErrorCode.GONE, 'The configuration has expired');

export const engineRefusal = () =>
  createAppError(ErrorCode.VALIDATION_ERROR, "No variable 'no-such-variable'");

export function resetHarness(): void {
  vi.clearAllMocks();
  errorContexts.length = 0;
  configuratorFeature({ enabled: true });
  getConfiguratorBackend.mockReturnValue(backend);
  buildConfiguratorContext.mockReturnValue(CTX);
}

// ---------------------------------------------------------------------------
// The cases every lifecycle route answers the same way
//
// Written once because the gate and the pass-through are the same code in all
// six routes: a case that only held for the one route somebody remembered to
// write it for would be the bug worth catching.
// ---------------------------------------------------------------------------

export function lifecycleCases(spec: {
  /** Read lazily: the handler is imported in the caller's `beforeEach`. */
  handler: () => RouteHandler;
  /** The backend method this route is expected to reach. */
  method: keyof ConfiguratorBackend;
  /** A request this route accepts, apart from what the case changes. */
  event: (init?: {
    authenticated?: boolean;
    mode?: 'commerce' | 'catalog';
    withoutConfig?: boolean;
    withoutTenant?: boolean;
  }) => H3Event;
  /** What the backend resolves with when the route is expected to reach it. */
  result: unknown;
  /** The name an unexpected failure is logged under. */
  operation: string;
}): void {
  const reach = () => backend[spec.method].mockResolvedValue(spec.result);

  describe('the gate', () => {
    it('answers 404 when the tenant has no configurator feature', async () => {
      configuratorFeature(undefined);
      const event = spec.event();

      await expect(spec.handler()(event)).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(bodyReads).not.toHaveBeenCalled();
      expect(getConfiguratorBackend).not.toHaveBeenCalled();
    });

    it('answers 404 when configurator is off, before the body is read', async () => {
      configuratorFeature({ enabled: false });
      // Unparseable for every schema here, so a route that read it first would
      // answer 400 and fail this case rather than pass it by accident.
      const event = spec.event();
      (event as unknown as { body: unknown }).body = { nonsense: true };

      await expect(spec.handler()(event)).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(bodyReads).not.toHaveBeenCalled();
    });

    it('sets Cache-Control even on the 404 the gate answers', async () => {
      configuratorFeature({ enabled: false });
      const event = spec.event();

      await expect(spec.handler()(event)).rejects.toThrow();
      expect(headersOf(event)['Cache-Control']).toBe('private, no-store');
    });

    it('lets a request through when configurator is enabled with no access rule', async () => {
      configuratorFeature({ enabled: true });
      reach();

      await spec.handler()(spec.event());

      expect(backend[spec.method]).toHaveBeenCalled();
    });

    it("lets an anonymous request through when configurator access is 'all'", async () => {
      configuratorFeature({ enabled: true, access: 'all' });
      reach();

      await spec.handler()(spec.event());

      expect(backend[spec.method]).toHaveBeenCalled();
    });

    it("answers 404 for an anonymous request when configurator access is 'authenticated'", async () => {
      configuratorFeature({ enabled: true, access: 'authenticated' });
      const event = spec.event();

      await expect(spec.handler()(event)).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(bodyReads).not.toHaveBeenCalled();
    });

    it("lets a signed-in request through when configurator access is 'authenticated'", async () => {
      configuratorFeature({ enabled: true, access: 'authenticated' });
      reach();

      await spec.handler()(spec.event({ authenticated: true }));

      expect(backend[spec.method]).toHaveBeenCalled();
    });

    it('refuses a catalogue-mode tenant with 403', async () => {
      const event = spec.event({ mode: 'catalog' });

      await expect(spec.handler()(event)).rejects.toMatchObject({
        statusCode: 403,
        message: 'Not available in catalogue mode',
      });
      expect(bodyReads).not.toHaveBeenCalled();
    });

    it.each([
      ['a tenant resolved without a config', { withoutConfig: true }],
      ['no tenant on the event at all', { withoutTenant: true }],
    ])('treats %s as not in catalogue mode', async (_case, init) => {
      reach();

      await spec.handler()(spec.event(init));

      expect(backend[spec.method]).toHaveBeenCalled();
    });
  });

  it('reports an unexpected failure under its own operation name', async () => {
    reach();

    await spec.handler()(spec.event());

    expect(errorContexts).toContainEqual({ operation: spec.operation });
  });

  describe('what the engine raises', () => {
    it('passes 404 for an unknown configuration through unchanged', async () => {
      backend[spec.method].mockRejectedValue(unknownConfiguration());

      await expect(spec.handler()(spec.event())).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('passes 410 for an expired configuration through unchanged', async () => {
      backend[spec.method].mockRejectedValue(expiredConfiguration());

      await expect(spec.handler()(spec.event())).rejects.toMatchObject({
        statusCode: 410,
      });
    });

    it('passes 422 for a refusal through unchanged', async () => {
      backend[spec.method].mockRejectedValue(engineRefusal());

      await expect(spec.handler()(spec.event())).rejects.toMatchObject({
        statusCode: 422,
      });
    });
  });
}

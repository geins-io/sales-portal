/**
 * `sentry.server.config.ts` initialises Sentry as a side effect of being
 * imported, so each test sets the environment and imports a fresh copy.
 *
 * Two options guard a long-running server against a stalled ingest
 * connection: our own `Http` integration replaces the one `@sentry/nuxt` adds
 * by default, whose response hook flushes on every request, and the transport
 * sends through an HTTP module that destroys a request once it goes idle.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SENTRY_TRANSPORT_IDLE_TIMEOUT_MS } from '../../server/sentry-transport';

const { init, httpIntegration } = vi.hoisted(() => ({
  init: vi.fn(),
  httpIntegration: vi.fn(() => ({ name: 'Http' })),
}));

vi.mock('@sentry/nuxt', () => ({ init, httpIntegration }));

interface InitOptions {
  integrations: unknown[];
  transportOptions: {
    httpModule: {
      request: (options: object) => { setTimeout: unknown };
    };
  };
}

async function loadConfig(): Promise<InitOptions | undefined> {
  vi.resetModules();
  await import('../../sentry.server.config');
  return init.mock.calls[0]?.[0] as InitOptions | undefined;
}

describe.sequential('sentry.server.config', () => {
  beforeEach(() => {
    init.mockClear();
    httpIntegration.mockClear();
    vi.stubEnv('NUXT_SENTRY_DSN', 'http://public@127.0.0.1:9/1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('replaces the default Http integration with one of its own', async () => {
    const options = await loadConfig();

    expect(httpIntegration).toHaveBeenCalledTimes(1);
    expect(httpIntegration).toHaveBeenCalledWith();
    expect(options?.integrations).toEqual([
      httpIntegration.mock.results[0]?.value,
    ]);
  });

  it('sends through an HTTP module that idles requests out', async () => {
    const http = await import('node:http');
    const setTimeout = vi.fn();
    vi.spyOn(http.default, 'request').mockReturnValue({
      setTimeout,
    } as unknown as ReturnType<typeof http.request>);

    const options = await loadConfig();
    options?.transportOptions.httpModule.request({ protocol: 'http:' });

    expect(setTimeout).toHaveBeenCalledWith(
      SENTRY_TRANSPORT_IDLE_TIMEOUT_MS,
      expect.any(Function),
    );
  });

  it('does not initialise without a DSN', async () => {
    vi.stubEnv('NUXT_SENTRY_DSN', '');

    await loadConfig();

    expect(init).not.toHaveBeenCalled();
  });
});

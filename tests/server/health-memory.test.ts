/**
 * `/api/health` grades RSS against thresholds from `runtimeConfig.health`.
 *
 * Two halves, and the second is the one that matters: the resolver's defaults
 * can be read off the source, but only the handler proves that the endpoint
 * acts on the configured numbers. Every verdict below is produced by changing
 * the configuration and re-reading the response, never by asserting the stub.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import type { H3Event } from 'h3';
import {
  DEFAULT_RSS_DEGRADED_MB,
  DEFAULT_RSS_UNHEALTHY_MB,
  resolveMemoryGrading,
} from '../../server/utils/health-memory';

describe('resolveMemoryGrading', () => {
  it('grades at the production thresholds when nothing is configured', () => {
    expect(resolveMemoryGrading()).toEqual({
      gradeRss: true,
      degradedMb: 400,
      unhealthyMb: 900,
    });
  });

  it('exports the production thresholds as its defaults', () => {
    expect(DEFAULT_RSS_DEGRADED_MB).toBe(400);
    expect(DEFAULT_RSS_UNHEALTHY_MB).toBe(900);
  });

  it('uses configured numbers', () => {
    expect(
      resolveMemoryGrading({ rssDegradedMb: 1500, rssUnhealthyMb: 4000 }),
    ).toEqual({ gradeRss: true, degradedMb: 1500, unhealthyMb: 4000 });
  });

  it('parses a threshold that arrives as a string', () => {
    // An env override Nuxt did not coerce, e.g. NUXT_HEALTH_RSS_DEGRADED_MB.
    expect(resolveMemoryGrading({ rssDegradedMb: '1500' }).degradedMb).toBe(
      1500,
    );
  });

  it.each([
    ['a typo', 'a lot'],
    ['an empty string', ''],
    ['zero', 0],
    ['a negative number', -1],
    ['null', null],
    ['undefined', undefined],
  ])('falls back to the production threshold for %s', (_case, value) => {
    const grading = resolveMemoryGrading({
      rssDegradedMb: value,
      rssUnhealthyMb: value,
    });

    expect(grading).toEqual({
      gradeRss: true,
      degradedMb: 400,
      unhealthyMb: 900,
    });
  });

  it('grades unless grading is turned off explicitly', () => {
    expect(resolveMemoryGrading({}).gradeRss).toBe(true);
    expect(resolveMemoryGrading({ gradeRss: undefined }).gradeRss).toBe(true);
    expect(resolveMemoryGrading({ gradeRss: false }).gradeRss).toBe(false);
    // An env override arrives as a string.
    expect(resolveMemoryGrading({ gradeRss: 'false' }).gradeRss).toBe(false);
  });
});

/**
 * `useRuntimeConfig` reaches the handler as an auto-import, which only
 * `mockNuxtImport` can intercept — `vi.stubGlobal` leaves the real one in
 * place, and the real one happens to carry the production thresholds, so a
 * test written that way would pass without proving anything.
 */
const { runtimeConfigMock, setResponseStatusMock } = vi.hoisted(() => ({
  runtimeConfigMock: {
    current: {} as Record<string, unknown>,
  },
  setResponseStatusMock: vi.fn<(event: unknown, code: number) => void>(),
}));

mockNuxtImport('useRuntimeConfig', () => () => runtimeConfigMock.current);
mockNuxtImport('setResponseStatus', () => setResponseStatusMock);

/** The `runtimeConfig.health` a request sees; `undefined` omits the key. */
function setHealth(health: Record<string, unknown> | undefined): void {
  runtimeConfigMock.current = {
    public: { appVersion: '1.0.0', commitSha: 'abc123', environment: 'test' },
    healthCheckSecret: '',
    storage: { driver: 'memory' },
    ...(health ? { health } : {}),
  };
}

describe('GET /api/health memory grading', () => {
  interface MemoryCheck {
    status: string;
    message?: string;
    details?: Record<string, number>;
  }
  interface HealthResponse {
    status: string;
    checks: { memory: MemoryCheck };
  }

  /** An event with no `context.logger`, which is what returns the details. */
  const event = {
    context: {},
    _query: { quick: 'true' },
  } as unknown as H3Event;

  function withRss(rssMB: number): void {
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: rssMB * 1024 * 1024,
      heapTotal: 200 * 1024 * 1024,
      heapUsed: 100 * 1024 * 1024,
      external: 10 * 1024 * 1024,
      arrayBuffers: 1 * 1024 * 1024,
    });
  }

  async function healthFor(rssMB: number): Promise<HealthResponse> {
    withRss(rssMB);
    const module = await import('../../server/api/health.get');
    const handler = module.default as (
      event: H3Event,
    ) => Promise<HealthResponse>;
    return handler(event);
  }

  beforeEach(() => {
    vi.resetModules();
    setResponseStatusMock.mockClear();
    setHealth(undefined);
    vi.stubGlobal(
      'defineEventHandler',
      (handler: (event: H3Event) => unknown) => handler,
    );
    vi.stubGlobal(
      'getQuery',
      (e: H3Event) =>
        (e as H3Event & { _query?: Record<string, string> })._query ?? {},
    );
    vi.stubGlobal('setResponseHeaders', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('with the production configuration', () => {
    beforeEach(() => {
      setHealth({ gradeRss: true, rssDegradedMb: 400, rssUnhealthyMb: 900 });
    });

    it('reports healthy below the degraded threshold', async () => {
      const response = await healthFor(300);

      expect(response.checks.memory.status).toBe('healthy');
      expect(setResponseStatusMock).not.toHaveBeenCalled();
    });

    it('reports degraded above 400 MB, still answering 200', async () => {
      const response = await healthFor(500);

      expect(response.checks.memory.status).toBe('degraded');
      expect(setResponseStatusMock).toHaveBeenCalledWith(event, 200);
    });

    it('reports unhealthy above 900 MB and answers 503', async () => {
      const response = await healthFor(1000);

      expect(response.checks.memory.status).toBe('unhealthy');
      expect(setResponseStatusMock).toHaveBeenCalledWith(event, 503);
    });
  });

  it('applies the production thresholds when nothing is configured', async () => {
    // The deployed containers configure no thresholds, so this is what they
    // run: an absent `health` key must grade exactly as production does.
    setHealth(undefined);

    expect((await healthFor(1000)).checks.memory.status).toBe('unhealthy');
    expect((await healthFor(500)).checks.memory.status).toBe('degraded');
    expect((await healthFor(300)).checks.memory.status).toBe('healthy');
  });

  it('moves its verdict when the configured thresholds move', async () => {
    // The same RSS, graded twice: proof that the endpoint reads the config
    // rather than its own constants.
    setHealth({ gradeRss: true, rssDegradedMb: 400, rssUnhealthyMb: 900 });
    expect((await healthFor(1000)).checks.memory.status).toBe('unhealthy');

    setHealth({ gradeRss: true, rssDegradedMb: 2000, rssUnhealthyMb: 4000 });
    expect((await healthFor(1000)).checks.memory.status).toBe('healthy');
  });

  describe('with grading off, as the dev server has it', () => {
    beforeEach(() => {
      setHealth({ gradeRss: false, rssDegradedMb: 400, rssUnhealthyMb: 900 });
    });

    it('stays healthy at an RSS that would be unhealthy in a container', async () => {
      // 3982 MB is the measured peak of a dev server after two e2e suites.
      const response = await healthFor(3982);

      expect(response.status).toBe('healthy');
      expect(response.checks.memory.status).toBe('healthy');
      expect(setResponseStatusMock).not.toHaveBeenCalledWith(event, 503);
    });

    it('still reports the numbers and says the status is not a verdict', async () => {
      const response = await healthFor(3982);

      expect(response.checks.memory.details).toMatchObject({
        rssMB: 3982,
        heapUsedMB: 100,
        heapTotalMB: 200,
      });
      expect(response.checks.memory.message).toContain('3982MB');
      expect(response.checks.memory.message).toContain('not graded');
    });
  });
});

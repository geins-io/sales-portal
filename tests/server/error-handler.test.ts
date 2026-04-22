import { describe, it, expect, vi, beforeEach } from 'vitest';
import errorHandler, { escapeHtml, renderErrorHtml } from '../../server/error';

// --- Mocks ----------------------------------------------------------------

vi.mock('h3', () => ({
  getRequestHeader: (event: MockEvent, name: string) =>
    event.headers.get(name.toLowerCase()),
  setResponseHeader: (event: MockEvent, name: string, value: string) => {
    event.node.res.setHeader(name, value);
  },
  setResponseStatus: (event: MockEvent, code: number, msg?: string) => {
    event.node.res.statusCode = code;
    if (msg) event.node.res.statusMessage = msg;
  },
}));

vi.mock('../../server/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const { mockReadConfig } = vi.hoisted(() => ({
  mockReadConfig: vi.fn(() => ({ debugErrors: false })),
}));
vi.mock('../../server/utils/error-config', () => ({
  readErrorHandlerConfig: mockReadConfig,
}));

// --- Helpers -------------------------------------------------------------

interface MockEvent {
  method: string;
  path: string;
  context: {
    correlationId?: string;
    tenant?: { tenantId?: string; hostname?: string };
  };
  headers: Map<string, string>;
  node: {
    res: {
      statusCode: number;
      statusMessage: string;
      headers: Record<string, string>;
      body: string;
      headersSent: boolean;
      setHeader(k: string, v: string): void;
      end(body: string): void;
    };
  };
}

function makeEvent(
  overrides: {
    accept?: string;
    correlationId?: string | null;
    tenantId?: string | null;
    hostname?: string | null;
  } = {},
): MockEvent {
  const headers = new Map<string, string>();
  if (overrides.accept !== undefined) headers.set('accept', overrides.accept);
  const correlationId =
    overrides.correlationId === null
      ? undefined
      : (overrides.correlationId ?? 'corr-abc');
  const tenantId =
    overrides.tenantId === null
      ? undefined
      : (overrides.tenantId ?? 'boattools');
  const hostname =
    overrides.hostname === null
      ? undefined
      : (overrides.hostname ?? 'boattools.litium.store');
  return {
    method: 'GET',
    path: '/se/sv/',
    context: {
      correlationId,
      tenant: tenantId || hostname ? { tenantId, hostname } : undefined,
    },
    headers,
    node: {
      res: {
        statusCode: 200,
        statusMessage: '',
        headers: {},
        body: '',
        headersSent: false,
        setHeader(k: string, v: string) {
          this.headers[k] = v;
        },
        end(body: string) {
          this.body = body;
        },
      },
    },
  };
}

function run(event: MockEvent, error: Error & { statusCode?: number }) {
  errorHandler(error, event as unknown as Parameters<typeof errorHandler>[1]);
}

// --- Tests ---------------------------------------------------------------

describe('escapeHtml', () => {
  it('escapes the five HTML-breaking characters', () => {
    expect(escapeHtml('<script>alert("hi")</script>')).toBe(
      '&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt;',
    );
    expect(escapeHtml("a'b")).toBe('a&#39;b');
    expect(escapeHtml('a&b')).toBe('a&amp;b');
  });

  it('passes innocuous strings through unchanged', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123');
  });
});

describe('renderErrorHtml', () => {
  it('shows Reference ID, Tenant, and distinct message for a 500 with full context', () => {
    const html = renderErrorHtml({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Nuxt I18n server context has not been set up yet.',
      correlationId: 'abc-123',
      tenantId: 'boattools',
      hostname: 'boattools.litium.store',
    });
    expect(html).toContain('500');
    expect(html).toContain('Something went wrong');
    expect(html).toContain('Reference ID:');
    expect(html).toContain('abc-123');
    expect(html).toContain('Tenant:');
    expect(html).toContain('boattools');
    expect(html).toContain('Nuxt I18n server context has not been set up yet.');
  });

  it('hides the Host row when it equals the tenantId', () => {
    const html = renderErrorHtml({
      statusCode: 500,
      statusMessage: 'x',
      message: 'y',
      correlationId: 'id',
      tenantId: 'same',
      hostname: 'same',
    });
    expect(html).not.toContain('Host:');
  });

  it('hides the diagnostics block on 404 without a correlation ID', () => {
    const html = renderErrorHtml({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Not Found',
      correlationId: undefined,
      tenantId: 'boattools',
      hostname: 'boattools.litium.store',
    });
    expect(html).toContain('Page not found');
    expect(html).not.toContain('Reference ID');
    expect(html).not.toContain('class="diag"');
  });

  it('shows the diagnostics block on 404 if a correlation ID is present', () => {
    const html = renderErrorHtml({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Not Found',
      correlationId: 'id-404',
      tenantId: undefined,
      hostname: undefined,
    });
    expect(html).toContain('Reference ID');
    expect(html).toContain('id-404');
    // 404 doesn't surface tenant/host rows even when present
    expect(html).not.toContain('Tenant:');
  });

  it('suppresses the raw message when it duplicates the friendly copy', () => {
    const html = renderErrorHtml({
      statusCode: 500,
      statusMessage: 'Error',
      message:
        'We hit an unexpected error. The technical team has been notified.',
      correlationId: 'id',
      tenantId: undefined,
      hostname: undefined,
    });
    // Friendly copy appears once in the description. The raw-message
    // element only renders when we DO have a distinct message.
    expect(html).not.toMatch(/<p class="diag-msg"/);
  });

  it('escapes every user-controlled string', () => {
    const html = renderErrorHtml({
      statusCode: 500,
      statusMessage: 'Error',
      message: '"><script>bad()</script>',
      correlationId: '<img src=x onerror=alert(1)>',
      tenantId: '</style><script>',
      hostname: 'evil"onmouseover="alert(1)"',
    });
    // None of the attack vectors survive raw into the document.
    expect(html).not.toContain('<script>bad()</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('</style><script>');
    expect(html).not.toMatch(/evil"onmouseover="alert/);
    // They appear escaped.
    expect(html).toContain('&lt;script&gt;bad()&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x');
  });

  it('appends a stack block only when one was passed', () => {
    const withStack = renderErrorHtml({
      statusCode: 500,
      statusMessage: 'Error',
      message: 'boom',
      correlationId: 'x',
      tenantId: undefined,
      hostname: undefined,
      stack: 'Error: boom\n    at foo (/a.js:1:1)',
    });
    expect(withStack).toContain('class="stack"');
    expect(withStack).toContain('at foo');

    const withoutStack = renderErrorHtml({
      statusCode: 500,
      statusMessage: 'Error',
      message: 'boom',
      correlationId: 'x',
      tenantId: undefined,
      hostname: undefined,
    });
    expect(withoutStack).not.toContain('class="stack"');
  });
});

describe('errorHandler (Nitro integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadConfig.mockReturnValue({ debugErrors: false });
  });

  it('returns self-contained HTML when Accept includes text/html', () => {
    const event = makeEvent({ accept: 'text/html,application/xhtml+xml' });
    const err = Object.assign(
      new Error('Nuxt I18n server context has not been set up yet.'),
      { statusCode: 500 },
    );
    run(event, err);

    expect(event.node.res.statusCode).toBe(500);
    expect(event.node.res.headers['content-type']).toMatch(/text\/html/);
    expect(event.node.res.body).toContain('<!doctype html>');
    expect(event.node.res.body).toContain('Something went wrong');
    expect(event.node.res.body).toContain(
      'Nuxt I18n server context has not been set up yet.',
    );
    expect(event.node.res.body).toContain('corr-abc');
    expect(event.node.res.body).toContain('boattools');
  });

  it('returns JSON when Accept does not include text/html', () => {
    const event = makeEvent({ accept: 'application/json' });
    const err = Object.assign(new Error('boom'), { statusCode: 500 });
    run(event, err);

    expect(event.node.res.headers['content-type']).toMatch(/application\/json/);
    const parsed = JSON.parse(event.node.res.body);
    expect(parsed).toMatchObject({
      error: true,
      statusCode: 500,
      message: 'boom',
      correlationId: 'corr-abc',
      tenantId: 'boattools',
      hostname: 'boattools.litium.store',
    });
    expect(parsed.stack).toBeUndefined();
  });

  it('includes stack in JSON when debugErrors is enabled', () => {
    mockReadConfig.mockReturnValue({ debugErrors: true });
    const event = makeEvent({ accept: 'application/json' });
    const err = Object.assign(new Error('boom'), {
      statusCode: 500,
      stack: 'Error: boom\n    at foo (/a.js:1:1)',
    });
    run(event, err);

    const parsed = JSON.parse(event.node.res.body);
    expect(Array.isArray(parsed.stack)).toBe(true);
    expect(parsed.stack[0]).toContain('Error: boom');
  });

  it('includes stack in HTML when debugErrors is enabled', () => {
    mockReadConfig.mockReturnValue({ debugErrors: true });
    const event = makeEvent({ accept: 'text/html' });
    const err = Object.assign(new Error('boom'), {
      statusCode: 500,
      stack: 'Error: boom\n    at foo (/a.js:1:1)',
    });
    run(event, err);

    expect(event.node.res.body).toContain('class="stack"');
    expect(event.node.res.body).toContain('at foo');
  });

  it('always sets x-correlation-id and x-tenant-id headers', () => {
    const event = makeEvent({ accept: '*/*' });
    const err = Object.assign(new Error('x'), { statusCode: 500 });
    run(event, err);

    expect(event.node.res.headers['x-correlation-id']).toBe('corr-abc');
    expect(event.node.res.headers['x-tenant-id']).toBe('boattools');
  });

  it('omits tenant headers when tenant context was never set', () => {
    const event = makeEvent({
      accept: 'application/json',
      tenantId: null,
      hostname: null,
    });
    const err = Object.assign(new Error('early'), { statusCode: 500 });
    run(event, err);

    expect(event.node.res.headers['x-correlation-id']).toBe('corr-abc');
    expect(event.node.res.headers['x-tenant-id']).toBeUndefined();
    const parsed = JSON.parse(event.node.res.body);
    expect(parsed.tenantId).toBeUndefined();
    expect(parsed.hostname).toBeUndefined();
  });

  it('mints a fallback correlation ID when the logging plugin never ran', () => {
    const event = makeEvent({
      accept: 'application/json',
      correlationId: null,
      tenantId: null,
      hostname: null,
    });
    const err = Object.assign(new Error('very-early-crash'), {
      statusCode: 500,
    });
    run(event, err);

    // Always get a non-empty correlation ID in the response body + header
    // so whatever happened, the user has SOMETHING to quote in a ticket.
    expect(event.node.res.headers['x-correlation-id']).toMatch(/.+/);
    const parsed = JSON.parse(event.node.res.body);
    expect(parsed.correlationId).toMatch(/.+/);
  });

  it('handles a 404 from plugin 01 by rendering the "Page not found" HTML', () => {
    const event = makeEvent({
      accept: 'text/html',
      tenantId: null,
      hostname: null,
    });
    const err = Object.assign(new Error('This site is not available.'), {
      statusCode: 404,
      statusMessage: 'Not Found',
    });
    run(event, err);

    expect(event.node.res.statusCode).toBe(404);
    expect(event.node.res.body).toContain('Page not found');
    // Still shows reference ID for the 404 because we have one — it's
    // cheap support context even for expected errors.
    expect(event.node.res.body).toContain('corr-abc');
  });

  it('logs 5xx errors at error level with full context', async () => {
    const { logger: importedLogger } =
      await import('../../server/utils/logger');
    const event = makeEvent({ accept: 'application/json' });
    const err = Object.assign(new Error('kaboom'), { statusCode: 503 });
    run(event, err);

    expect(importedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('→ 503'),
      expect.objectContaining({ message: 'kaboom' }),
      expect.objectContaining({
        correlationId: 'corr-abc',
        tenantId: 'boattools',
      }),
    );
  });

  it('does NOT log 4xx errors (expected user errors)', async () => {
    const { logger: importedLogger } =
      await import('../../server/utils/logger');
    const errorSpy = importedLogger.error as ReturnType<typeof vi.fn>;
    errorSpy.mockClear();
    const event = makeEvent({ accept: 'application/json' });
    const err = Object.assign(new Error('not found'), { statusCode: 404 });
    run(event, err);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { createEvent, type H3Event } from 'h3';

const mockGetRequestLocale = vi.fn();

vi.mock('../../../server/utils/locale', () => ({
  getRequestLocale: (...args: unknown[]) => mockGetRequestLocale(...args),
}));

// `buildSiteUrl` is stubbed to keep the URL assertions independent of protocol
// and port handling. `isIndexable` is the real one: it is the only thing that
// turns a tenant's `seo.robots` into the `indexable` flag pushed below, so a
// stub returning a constant would make the robots cases prove nothing.
vi.mock('../../../server/utils/seo', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    buildSiteUrl: (hostname: string) => `https://${hostname}`,
  };
});

const { mockUpdateSiteConfig } = vi.hoisted(() => ({
  mockUpdateSiteConfig: vi.fn(),
}));
vi.mock('#site-config/server', () => ({
  updateSiteConfig: mockUpdateSiteConfig,
}));
vi.stubGlobal('defineEventHandler', (fn: (event: H3Event) => unknown) => fn);

function tenantEvent(
  tenantConfig: Record<string, unknown> | undefined,
  path = '/se/sv/',
): H3Event {
  const req = new IncomingMessage(new Socket());
  req.url = path;
  const event = createEvent(req, new ServerResponse(req));
  Object.assign(event.context, {
    tenant: tenantConfig ? { config: tenantConfig } : undefined,
  });
  return event;
}

/** What the middleware handed to updateSiteConfig, one entry per call. */
function pushed(): Record<string, unknown>[] {
  return mockUpdateSiteConfig.mock.calls.map(([, input]) => input);
}

const TENANT = {
  hostname: 'alpha.example',
  branding: { name: 'Alpha' },
  seo: { defaultDescription: 'desc', robots: undefined },
  geinsSettings: { locale: 'nb-NO' },
};

let handler: (event: H3Event) => unknown;

describe('server/middleware/seo-config', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    handler = (await import('../../../server/middleware/seo-config')).default;
  });

  it('pushes the requested locale as currentLocale', async () => {
    mockGetRequestLocale.mockReturnValue('fi-FI');
    const event = tenantEvent(TENANT);

    await handler(event);

    expect(pushed()).toHaveLength(1);
    expect(pushed()[0]).toMatchObject({
      currentLocale: 'fi-FI',
      defaultLocale: 'nb-NO',
      url: 'https://alpha.example',
    });
  });

  it("falls back to 'sv-SE' when nothing upstream resolved a locale", async () => {
    mockGetRequestLocale.mockReturnValue(undefined);
    const event = tenantEvent({
      ...TENANT,
      geinsSettings: { locale: undefined },
    });

    await handler(event);

    expect(pushed()[0]).toMatchObject({ currentLocale: 'sv-SE' });
  });

  it('never pushes an undefined currentLocale', async () => {
    mockGetRequestLocale.mockReturnValue(undefined);
    const event = tenantEvent({
      ...TENANT,
      geinsSettings: { locale: undefined },
    });

    await handler(event);

    expect(pushed()[0]!.currentLocale).toBeTypeOf('string');
  });

  it('pushes indexable false when the tenant robots value carries noindex', async () => {
    mockGetRequestLocale.mockReturnValue('sv-SE');
    const event = tenantEvent({
      ...TENANT,
      seo: { defaultDescription: 'desc', robots: 'noindex, nofollow' },
    });

    await handler(event);

    expect(pushed()[0]).toMatchObject({ indexable: false });
  });

  it('pushes indexable true when the tenant robots value allows indexing', async () => {
    mockGetRequestLocale.mockReturnValue('sv-SE');
    const event = tenantEvent({
      ...TENANT,
      seo: { defaultDescription: 'desc', robots: 'index, follow' },
    });

    await handler(event);

    expect(pushed()[0]).toMatchObject({ indexable: true });
  });

  it("pushes onto the request's own site config", async () => {
    mockGetRequestLocale.mockReturnValue('sv-SE');
    const event = tenantEvent(TENANT);

    await handler(event);

    expect(mockUpdateSiteConfig).toHaveBeenCalledWith(event, expect.anything());
  });

  it('pushes the tenant name and description', async () => {
    mockGetRequestLocale.mockReturnValue('sv-SE');
    await handler(tenantEvent(TENANT));

    expect(pushed()[0]).toMatchObject({ name: 'Alpha', description: 'desc' });
  });

  it('pushes an empty description and indexable true for a tenant with no seo settings', async () => {
    mockGetRequestLocale.mockReturnValue('sv-SE');
    await handler(tenantEvent({ ...TENANT, seo: undefined }));

    expect(pushed()[0]).toMatchObject({ description: '', indexable: true });
  });

  it('skips health check paths', async () => {
    const event = tenantEvent(TENANT, '/api/health/live');

    await handler(event);

    expect(pushed()).toHaveLength(0);
    expect(mockGetRequestLocale).not.toHaveBeenCalled();
  });

  it('skips requests with no resolved tenant', async () => {
    const event = tenantEvent(undefined);

    await handler(event);

    expect(pushed()).toHaveLength(0);
  });
});

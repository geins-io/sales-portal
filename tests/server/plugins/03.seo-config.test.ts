import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

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

let hooks: Record<string, (ctx: unknown) => Promise<void> | void> = {};

vi.stubGlobal('defineNitroPlugin', (fn: (nitroApp: unknown) => void) => {
  hooks = {};
  fn({
    hooks: {
      hook: (name: string, cb: (ctx: unknown) => Promise<void> | void) => {
        hooks[name] = cb;
      },
    },
  });
});

function createCtx(
  tenantConfig: Record<string, unknown> | undefined,
  path = '/se/sv/',
) {
  const pushed: Record<string, unknown>[] = [];
  return {
    pushed,
    ctx: {
      event: {
        path,
        context: {
          tenant: tenantConfig ? { config: tenantConfig } : undefined,
        },
      } as unknown as H3Event,
      siteConfig: {
        push: (config: Record<string, unknown>) => pushed.push(config),
      },
    },
  };
}

const TENANT = {
  hostname: 'alpha.example',
  branding: { name: 'Alpha' },
  seo: { defaultDescription: 'desc', robots: undefined },
  geinsSettings: { locale: 'nb-NO' },
};

describe('server/plugins/03.seo-config', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    await import('../../../server/plugins/03.seo-config');
  });

  it('pushes the requested locale as currentLocale', async () => {
    mockGetRequestLocale.mockReturnValue('fi-FI');
    const { ctx, pushed } = createCtx(TENANT);

    await hooks['site-config:init']!(ctx);

    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toMatchObject({
      currentLocale: 'fi-FI',
      defaultLocale: 'nb-NO',
      url: 'https://alpha.example',
    });
  });

  it("falls back to 'sv-SE' when nothing upstream resolved a locale", async () => {
    mockGetRequestLocale.mockReturnValue(undefined);
    const { ctx, pushed } = createCtx({
      ...TENANT,
      geinsSettings: { locale: undefined },
    });

    await hooks['site-config:init']!(ctx);

    expect(pushed[0]).toMatchObject({ currentLocale: 'sv-SE' });
  });

  it('never pushes an undefined currentLocale', async () => {
    mockGetRequestLocale.mockReturnValue(undefined);
    const { ctx, pushed } = createCtx({
      ...TENANT,
      geinsSettings: { locale: undefined },
    });

    await hooks['site-config:init']!(ctx);

    expect(pushed[0]!.currentLocale).toBeTypeOf('string');
  });

  it('pushes indexable false when the tenant robots value carries noindex', async () => {
    mockGetRequestLocale.mockReturnValue('sv-SE');
    const { ctx, pushed } = createCtx({
      ...TENANT,
      seo: { defaultDescription: 'desc', robots: 'noindex, nofollow' },
    });

    await hooks['site-config:init']!(ctx);

    expect(pushed[0]).toMatchObject({ indexable: false });
  });

  it('pushes indexable true when the tenant robots value allows indexing', async () => {
    mockGetRequestLocale.mockReturnValue('sv-SE');
    const { ctx, pushed } = createCtx({
      ...TENANT,
      seo: { defaultDescription: 'desc', robots: 'index, follow' },
    });

    await hooks['site-config:init']!(ctx);

    expect(pushed[0]).toMatchObject({ indexable: true });
  });

  it('skips health check paths', async () => {
    const { ctx, pushed } = createCtx(TENANT, '/api/health/live');

    await hooks['site-config:init']!(ctx);

    expect(pushed).toHaveLength(0);
    expect(mockGetRequestLocale).not.toHaveBeenCalled();
  });

  it('skips requests with no resolved tenant', async () => {
    const { ctx, pushed } = createCtx(undefined);

    await hooks['site-config:init']!(ctx);

    expect(pushed).toHaveLength(0);
  });
});

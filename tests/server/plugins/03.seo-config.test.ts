import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

const mockGetRequestLocale = vi.fn();

vi.mock('../../../server/utils/locale', () => ({
  getRequestLocale: (...args: unknown[]) => mockGetRequestLocale(...args),
}));

vi.mock('../../../server/utils/seo', () => ({
  buildSiteUrl: (hostname: string) => `https://${hostname}`,
  isIndexable: () => true,
}));

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
  hostname: 'tenant-a.example',
  branding: { name: 'Tenant A' },
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
      url: 'https://tenant-a.example',
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

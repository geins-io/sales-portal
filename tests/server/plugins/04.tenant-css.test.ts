import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

/**
 * The last hop for four config groups at once: `css` (sanitised and injected),
 * `theme.name` as the `data-theme` attribute, `branding.faviconUrl` as a link
 * tag, and `theme.typography` as the Google Fonts link. Everything the plugin
 * emits is a raw HTML string pushed onto the render context, so the assertions
 * are on those strings.
 *
 * Same harness shape as 03.seo-config.test.ts: `defineNitroPlugin` is stubbed
 * to capture the hook, which is then called with a synthetic html object.
 */
let hooks: Record<
  string,
  (html: RenderHtml, ctx: { event: H3Event }) => Promise<void> | void
> = {};

vi.stubGlobal('defineNitroPlugin', (fn: (nitroApp: unknown) => void) => {
  hooks = {};
  fn({
    hooks: {
      hook: (
        name: string,
        cb: (html: RenderHtml, ctx: { event: H3Event }) => Promise<void> | void,
      ) => {
        hooks[name] = cb;
      },
    },
  });
});

interface RenderHtml {
  htmlAttrs: string[];
  head: string[];
}

function createHtml(): RenderHtml {
  return { htmlAttrs: [], head: [] };
}

function createEvent(config: Record<string, unknown> | undefined): {
  event: H3Event;
} {
  return {
    event: {
      context: { tenant: config ? { config } : undefined },
    } as unknown as H3Event,
  };
}

const CSS = "[data-theme='ocean'] {\n  --primary: #161616;\n}";

const TENANT = {
  theme: { name: 'ocean' },
  css: CSS,
  branding: { name: 'Ocean' },
};

async function render(config: Record<string, unknown> | undefined) {
  const html = createHtml();
  const hook = hooks['render:html'];
  if (hook) await hook(html, createEvent(config));
  return html;
}

describe('server/plugins/04.tenant-css', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    await import('../../../server/plugins/04.tenant-css');
  });

  it('does nothing when no tenant is resolved', async () => {
    const html = await render(undefined);
    expect(html.htmlAttrs).toEqual([]);
    expect(html.head).toEqual([]);
  });

  describe('css', () => {
    it('injects the tenant css in a style tag tagged with the theme name', async () => {
      const html = await render(TENANT);
      expect(html.head).toContain(
        `<style data-tenant-theme="ocean">${CSS}</style>`,
      );
    });

    it('strips a script tag out of the tenant css before injecting it', async () => {
      const html = await render({
        ...TENANT,
        css: 'a{} </style><script>alert(1)</script>',
      });
      // sanitizeTenantCss reduces that payload to the bare rule.
      expect(html.head).toContain(
        '<style data-tenant-theme="ocean">a{}</style>',
      );
      expect(html.head.join('')).not.toContain('<script>');
    });

    it('injects no style tag when the tenant has no css', async () => {
      const html = await render({ ...TENANT, css: undefined });
      expect(html.head.some((tag) => tag.startsWith('<style'))).toBe(false);
    });
  });

  describe('theme.name', () => {
    it('sets the data-theme attribute from the tenant theme name', async () => {
      const html = await render(TENANT);
      expect(html.htmlAttrs).toContain(' data-theme="ocean"');
    });

    it('falls back to the default theme name when the tenant theme has no name', async () => {
      const html = await render({ ...TENANT, theme: {} });
      expect(html.htmlAttrs).toContain(' data-theme="default"');
    });

    it('escapes a quote in the theme name before it reaches the attribute', async () => {
      // The value lands inside a double-quoted attribute, so an unescaped
      // quote would let the rest of the name become markup.
      const html = await render({ ...TENANT, theme: { name: 'oc"ean' } });
      expect(html.htmlAttrs).toContain(' data-theme="oc&quot;ean"');
    });
  });

  describe('branding.faviconUrl', () => {
    it('injects a favicon link for the configured faviconUrl', async () => {
      const html = await render({
        ...TENANT,
        branding: { name: 'Ocean', faviconUrl: 'https://cdn.example/fav.ico' },
      });
      expect(html.head).toContain(
        '<link rel="icon" href="https://cdn.example/fav.ico" type="image/x-icon">',
      );
    });

    it('injects no favicon link when faviconUrl is absent', async () => {
      const html = await render(TENANT);
      expect(html.head.some((tag) => tag.includes('rel="icon"'))).toBe(false);
    });

    it('injects no favicon link when faviconUrl is not an https url', async () => {
      // sanitizeUrl allows only https: and data:image/, so plain http is
      // dropped rather than emitted.
      const html = await render({
        ...TENANT,
        branding: { name: 'Ocean', faviconUrl: 'http://cdn.example/fav.ico' },
      });
      expect(html.head.some((tag) => tag.includes('rel="icon"'))).toBe(false);
    });
  });

  describe('theme.typography presence', () => {
    it('injects the google fonts stylesheet and preconnects when typography is configured', async () => {
      const html = await render({
        ...TENANT,
        theme: { name: 'ocean', typography: { fontFamily: 'Sentinel Body' } },
      });
      expect(html.head).toContain(
        '<link rel="preconnect" href="https://fonts.googleapis.com">',
      );
      expect(
        html.head.some(
          (tag) =>
            tag.startsWith('<link rel="stylesheet"') &&
            tag.includes('family=Sentinel+Body'),
        ),
        'fonts stylesheet',
      ).toBe(true);
    });

    it('injects no fonts link when the tenant has no typography', async () => {
      const html = await render(TENANT);
      expect(
        html.head.some((tag) => tag.includes('fonts.googleapis.com')),
      ).toBe(false);
      expect(html.head.some((tag) => tag.includes('fonts.gstatic.com'))).toBe(
        false,
      );
    });
  });
});

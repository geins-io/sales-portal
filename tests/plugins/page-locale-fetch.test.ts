import { describe, it, expect, vi } from 'vitest';

type Plugin = { name: string; enforce: string; setup: () => void };
let captured: Plugin | null = null;

vi.mock('#app/nuxt', () => ({
  defineNuxtPlugin: (plugin: Plugin) => {
    captured = plugin;
    return plugin;
  },
}));

const original = vi.fn(async () => new Response('ok'));
const location = { origin: 'https://shop.test', pathname: '/se/nb/portal' };
vi.stubGlobal('window', { fetch: original, location });

await import('../../app/plugins/00.page-locale-fetch.client');

describe('page-locale-fetch plugin', () => {
  it('runs before the other plugins, under its own name', () => {
    expect(captured?.enforce).toBe('pre');
    expect(captured?.name).toBe('page-locale-fetch');
  });

  it("sends the page's locale with the browser's fetch to /api", async () => {
    captured!.setup();

    await window.fetch('/api/cart', { method: 'GET' });
    location.pathname = '/se/da/cart';
    await window.fetch('/api/cart');

    expect(original.mock.calls).toEqual([
      ['/api/cart?locale=nb', { method: 'GET' }],
      ['/api/cart?locale=da', undefined],
    ]);
  });
});

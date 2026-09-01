import { describe, it, expect } from 'vitest';
import { isPagePath } from '../../../server/utils/is-page-path';

describe('isPagePath', () => {
  it('accepts page paths', () => {
    for (const p of [
      '/',
      '/se/sv/',
      '/se/sv/c/kategori-1',
      '/hejhej/blaha',
      '/about-us',
      '/p/foo/bar',
    ]) {
      expect(isPagePath(p), p).toBe(true);
    }
  });

  it('rejects runtime routes and root-served files', () => {
    for (const p of [
      '/api/products',
      '/_nuxt/entry.js',
      '/__nuxt_error',
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml',
      '/sitemap_index.xml',
      '/healthz',
      '/.well-known/security.txt',
      '/_ipx/w_100/img/x.png',
    ]) {
      expect(isPagePath(p), p).toBe(false);
    }
  });

  it('rejects a leading-underscore segment even without an extension', () => {
    expect(isPagePath('/_ipx/w_100/img/x')).toBe(false);
    expect(isPagePath('/_something')).toBe(false);
  });

  it('does not reject an underscore that is not the first segment', () => {
    expect(isPagePath('/se/sv/my_page')).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  routeLocaleMarket,
  resolveLocalePrefix,
} from '../../app/utils/locale-prefix';

const read = (rel: string) =>
  readFileSync(resolve(__dirname, '../../', rel), 'utf-8');

describe('routeLocaleMarket', () => {
  it('reads the :market/:locale params of a prefixed route', () => {
    expect(
      routeLocaleMarket({ params: { market: 'se', locale: 'nb' } }),
    ).toEqual({ market: 'se', locale: 'nb' });
  });

  it('parses the path when the route matched no prefixed pattern', () => {
    // The 404 case: no params, but the URL still carries the pair.
    expect(routeLocaleMarket({ params: {}, path: '/fi/da/nope' })).toEqual({
      market: 'fi',
      locale: 'da',
    });
  });

  it('prefers params over the path when they disagree', () => {
    expect(
      routeLocaleMarket({
        params: { market: 'dk', locale: 'da' },
        path: '/se/sv/portal',
      }),
    ).toEqual({ market: 'dk', locale: 'da' });
  });

  it('returns null for an unprefixed route', () => {
    expect(routeLocaleMarket({ params: {}, path: '/portal' })).toBeNull();
    expect(routeLocaleMarket({ params: {}, path: '/' })).toBeNull();
    expect(routeLocaleMarket(null)).toBeNull();
    expect(routeLocaleMarket(undefined)).toBeNull();
  });

  it('rejects segments that are not two-letter codes', () => {
    expect(routeLocaleMarket({ path: '/sverige/svenska/x' })).toBeNull();
    expect(routeLocaleMarket({ path: '/se/portal' })).toBeNull();
    expect(
      routeLocaleMarket({ params: { market: 'se', locale: 'SV' } }),
    ).toBeNull();
    expect(
      routeLocaleMarket({ params: { market: 12, locale: 'sv' } }),
    ).toBeNull();
  });

  it('needs both halves before it will answer', () => {
    expect(
      routeLocaleMarket({ params: { market: 'se' }, path: '/portal' }),
    ).toBeNull();
  });
});

describe('resolveLocalePrefix', () => {
  it('takes the route over cookies when they disagree', () => {
    // The reported bug: a deep link to /se/nb/portal must not be answered
    // with the cookie's language.
    const result = resolveLocalePrefix({
      route: { params: { market: 'se', locale: 'nb' } },
      marketCookie: 'fi',
      localeCookie: 'sv',
      tenant: { market: 'dk', locale: 'da-DK' },
    });
    expect(result.prefix).toBe('/se/nb');
  });

  it('takes the route over the tenant default on a cookieless request', () => {
    const result = resolveLocalePrefix({
      route: { params: {}, path: '/se/nb/portal' },
      marketCookie: null,
      localeCookie: null,
      tenant: { market: 'se', locale: 'sv-SE' },
    });
    expect(result.prefix).toBe('/se/nb');
  });

  it('falls to cookies for an unprefixed route', () => {
    const result = resolveLocalePrefix({
      route: { params: {}, path: '/portal' },
      marketCookie: 'no',
      localeCookie: 'en',
      tenant: { market: 'se', locale: 'sv-SE' },
    });
    expect(result.prefix).toBe('/no/en');
  });

  it('falls to the tenant defaults when route and cookies are silent', () => {
    const result = resolveLocalePrefix({
      route: { path: '/portal' },
      tenant: { market: 'dk', locale: 'da-DK' },
    });
    expect(result).toEqual({ market: 'dk', locale: 'da', prefix: '/dk/da' });
  });

  it("falls to the 'se'/'sv' pair when nothing yields a value", () => {
    expect(resolveLocalePrefix({}).prefix).toBe('/se/sv');
    expect(resolveLocalePrefix({ route: null, tenant: null }).prefix).toBe(
      '/se/sv',
    );
  });

  it('mixes sources per axis rather than picking one wholesale', () => {
    // Route carries no pair, market comes from the cookie, locale from config.
    const result = resolveLocalePrefix({
      route: { path: '/portal' },
      marketCookie: 'fi',
      localeCookie: null,
      tenant: { market: 'se', locale: 'nb-NO' },
    });
    expect(result.prefix).toBe('/fi/nb');
  });

  it('never emits a trailing slash', () => {
    expect(resolveLocalePrefix({}).prefix).not.toMatch(/\/$/);
  });
});

describe('the four redirect sites share one resolution order', () => {
  const sites = [
    'app/middleware/auth.ts',
    'app/middleware/guest.ts',
    'app/middleware/feature.ts',
    'app/error.vue',
  ];

  it('every site resolves its prefix through the shared helper', () => {
    for (const file of sites) {
      expect(read(file), file).toContain('resolveLocalePrefix');
    }
  });

  it('no site keeps an inline cookie-or-default chain', () => {
    // The drift this replaced: four hand-rolled copies, each free to diverge.
    for (const file of sites) {
      const source = read(file);
      expect(source, file).not.toMatch(/useCookie\('market'\)\.value \|\|/);
      expect(source, file).not.toMatch(/useCookie\('locale'\)\.value \|\|/);
    }
  });
});

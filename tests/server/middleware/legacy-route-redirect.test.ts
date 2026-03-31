import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Stub Nitro / H3 auto-imports
// ---------------------------------------------------------------------------
const sendRedirectMock = vi.fn();

vi.stubGlobal(
  'defineEventHandler',
  (fn: (event: unknown) => unknown) => fn,
);
vi.stubGlobal('sendRedirect', sendRedirectMock);

// Import handler after stubs are in place
const { default: handler } = await import(
  '../../../server/middleware/legacy-route-redirect'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createEvent(
  path: string,
  method: string = 'GET',
): Record<string, unknown> {
  return { path, method };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('legacy-route-redirect middleware', () => {
  beforeEach(() => {
    sendRedirectMock.mockReset();
  });

  describe('redirects bare paths to /c/ prefix', () => {
    it('redirects single-segment bare path', () => {
      const event = createEvent('/se/sv/material');
      (handler as (event: unknown) => unknown)(event);
      expect(sendRedirectMock).toHaveBeenCalledWith(
        event,
        '/se/sv/c/material',
        301,
      );
    });

    it('redirects multi-segment bare path', () => {
      const event = createEvent('/se/sv/material/epoxy');
      (handler as (event: unknown) => unknown)(event);
      expect(sendRedirectMock).toHaveBeenCalledWith(
        event,
        '/se/sv/c/material/epoxy',
        301,
      );
    });

    it('redirects deep nested bare path', () => {
      const event = createEvent('/se/sv/material/epoxy/product-name');
      (handler as (event: unknown) => unknown)(event);
      expect(sendRedirectMock).toHaveBeenCalledWith(
        event,
        '/se/sv/c/material/epoxy/product-name',
        301,
      );
    });

    it('preserves query string in redirect', () => {
      const event = createEvent('/se/sv/material?page=2&sort=name');
      (handler as (event: unknown) => unknown)(event);
      expect(sendRedirectMock).toHaveBeenCalledWith(
        event,
        '/se/sv/c/material?page=2&sort=name',
        301,
      );
    });

    it('works with different market/locale combos', () => {
      const event = createEvent('/dk/da/kategori');
      (handler as (event: unknown) => unknown)(event);
      expect(sendRedirectMock).toHaveBeenCalledWith(
        event,
        '/dk/da/c/kategori',
        301,
      );
    });
  });

  describe('skips paths with existing type prefixes', () => {
    const prefixes = ['c', 'p', 'b', 'l', 's', 'dc'];

    for (const prefix of prefixes) {
      it(`skips /${prefix}/ prefixed path`, () => {
        const event = createEvent(`/se/sv/${prefix}/some-entity`);
        (handler as (event: unknown) => unknown)(event);
        expect(sendRedirectMock).not.toHaveBeenCalled();
      });
    }
  });

  describe('skips known static routes', () => {
    const staticRoutes = [
      'cart',
      'checkout',
      'login',
      'portal',
      'contact',
      'apply-for-account',
      'reset-password',
      'search',
      'order-confirmation',
      'quote-confirmation',
      'elements',
      'error-test',
      'preview-widgets',
    ];

    for (const route of staticRoutes) {
      it(`skips /${route}`, () => {
        const event = createEvent(`/se/sv/${route}`);
        (handler as (event: unknown) => unknown)(event);
        expect(sendRedirectMock).not.toHaveBeenCalled();
      });
    }

    it('skips nested portal paths', () => {
      const event = createEvent('/se/sv/portal/orders');
      (handler as (event: unknown) => unknown)(event);
      expect(sendRedirectMock).not.toHaveBeenCalled();
    });
  });

  describe('skips non-matching requests', () => {
    it('skips non-GET requests', () => {
      const event = createEvent('/se/sv/material', 'POST');
      (handler as (event: unknown) => unknown)(event);
      expect(sendRedirectMock).not.toHaveBeenCalled();
    });

    it('skips API paths', () => {
      const event = createEvent('/api/products');
      (handler as (event: unknown) => unknown)(event);
      expect(sendRedirectMock).not.toHaveBeenCalled();
    });

    it('skips _nuxt paths', () => {
      const event = createEvent('/_nuxt/chunk-abc.js');
      (handler as (event: unknown) => unknown)(event);
      expect(sendRedirectMock).not.toHaveBeenCalled();
    });

    it('skips __nuxt paths', () => {
      const event = createEvent('/__nuxt_error');
      (handler as (event: unknown) => unknown)(event);
      expect(sendRedirectMock).not.toHaveBeenCalled();
    });

    it('skips homepage (no remaining path)', () => {
      const event = createEvent('/se/sv/');
      (handler as (event: unknown) => unknown)(event);
      expect(sendRedirectMock).not.toHaveBeenCalled();
    });

    it('skips homepage without trailing slash', () => {
      const event = createEvent('/se/sv');
      (handler as (event: unknown) => unknown)(event);
      expect(sendRedirectMock).not.toHaveBeenCalled();
    });

    it('skips paths that do not match market/locale pattern', () => {
      const event = createEvent('/some/random/path');
      (handler as (event: unknown) => unknown)(event);
      expect(sendRedirectMock).not.toHaveBeenCalled();
    });
  });
});

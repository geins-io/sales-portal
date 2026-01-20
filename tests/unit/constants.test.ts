import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  APP,
  API,
  STORAGE_KEYS,
  HTTP_STATUS,
  ROUTES,
  BREAKPOINTS,
  ANIMATION,
  DATE_FORMATS,
  VALIDATION,
  CURRENCY,
  DEFAULT_FEATURES,
  ENV,
} from '../../shared/constants';

describe('Application Constants', () => {
  describe('APP', () => {
    it('should have correct name', () => {
      expect(APP.NAME).toBe('Sales Portal');
    });

    it('should have a version', () => {
      expect(APP.VERSION).toBeDefined();
      expect(typeof APP.VERSION).toBe('string');
    });

    it('should have a description', () => {
      expect(APP.DESCRIPTION).toBeDefined();
      expect(typeof APP.DESCRIPTION).toBe('string');
    });
  });

  describe('API', () => {
    it('should have default timeout of 30 seconds', () => {
      expect(API.DEFAULT_TIMEOUT).toBe(30000);
    });

    it('should have reasonable page size defaults', () => {
      expect(API.DEFAULT_PAGE_SIZE).toBe(20);
      expect(API.MAX_PAGE_SIZE).toBe(100);
      expect(API.MAX_PAGE_SIZE).toBeGreaterThan(API.DEFAULT_PAGE_SIZE);
    });

    it('should have cache duration', () => {
      expect(API.CACHE_DURATION).toBeGreaterThan(0);
    });
  });

  describe('STORAGE_KEYS', () => {
    it('should have all required storage keys', () => {
      expect(STORAGE_KEYS.THEME).toBeDefined();
      expect(STORAGE_KEYS.AUTH_TOKEN).toBeDefined();
      expect(STORAGE_KEYS.USER_PREFERENCES).toBeDefined();
      expect(STORAGE_KEYS.RECENTLY_VIEWED).toBeDefined();
      expect(STORAGE_KEYS.CART).toBeDefined();
      expect(STORAGE_KEYS.WISHLIST).toBeDefined();
    });

    it('should have unique key values', () => {
      const keys = Object.values(STORAGE_KEYS);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  describe('HTTP_STATUS', () => {
    it('should have correct status codes', () => {
      expect(HTTP_STATUS.OK).toBe(200);
      expect(HTTP_STATUS.CREATED).toBe(201);
      expect(HTTP_STATUS.NO_CONTENT).toBe(204);
      expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
      expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
      expect(HTTP_STATUS.FORBIDDEN).toBe(403);
      expect(HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
    });
  });

  describe('ROUTES', () => {
    it('should have home route', () => {
      expect(ROUTES.HOME).toBe('/');
    });

    it('should have authentication routes', () => {
      expect(ROUTES.LOGIN).toBeDefined();
      expect(ROUTES.REGISTER).toBeDefined();
      expect(ROUTES.FORGOT_PASSWORD).toBeDefined();
    });

    it('should have product routes', () => {
      expect(ROUTES.PRODUCTS).toBeDefined();
      expect(ROUTES.PRODUCT_DETAIL).toContain(':id');
    });

    it('should have account routes', () => {
      expect(ROUTES.ACCOUNT).toBeDefined();
      expect(ROUTES.ACCOUNT_ORDERS).toBeDefined();
      expect(ROUTES.ACCOUNT_PROFILE).toBeDefined();
    });
  });

  describe('BREAKPOINTS', () => {
    it('should have Tailwind default breakpoints', () => {
      expect(BREAKPOINTS.SM).toBe(640);
      expect(BREAKPOINTS.MD).toBe(768);
      expect(BREAKPOINTS.LG).toBe(1024);
      expect(BREAKPOINTS.XL).toBe(1280);
      expect(BREAKPOINTS['2XL']).toBe(1536);
    });

    it('should be in ascending order', () => {
      expect(BREAKPOINTS.SM).toBeLessThan(BREAKPOINTS.MD);
      expect(BREAKPOINTS.MD).toBeLessThan(BREAKPOINTS.LG);
      expect(BREAKPOINTS.LG).toBeLessThan(BREAKPOINTS.XL);
      expect(BREAKPOINTS.XL).toBeLessThan(BREAKPOINTS['2XL']);
    });
  });

  describe('ANIMATION', () => {
    it('should have animation durations in ascending order', () => {
      expect(ANIMATION.FAST).toBeLessThan(ANIMATION.DEFAULT);
      expect(ANIMATION.DEFAULT).toBeLessThan(ANIMATION.SLOW);
      expect(ANIMATION.SLOW).toBeLessThan(ANIMATION.VERY_SLOW);
    });

    it('should have reasonable durations', () => {
      expect(ANIMATION.FAST).toBeGreaterThan(0);
      expect(ANIMATION.VERY_SLOW).toBeLessThan(1000);
    });
  });

  describe('DATE_FORMATS', () => {
    it('should have ISO format', () => {
      expect(DATE_FORMATS.ISO).toBeDefined();
    });

    it('should have various date formats', () => {
      expect(DATE_FORMATS.SHORT).toBeDefined();
      expect(DATE_FORMATS.LONG).toBeDefined();
      expect(DATE_FORMATS.DATETIME).toBeDefined();
      expect(DATE_FORMATS.TIME).toBeDefined();
    });
  });

  describe('VALIDATION', () => {
    it('should have reasonable password constraints', () => {
      expect(VALIDATION.PASSWORD_MIN_LENGTH).toBeGreaterThanOrEqual(8);
      expect(VALIDATION.PASSWORD_MAX_LENGTH).toBeGreaterThan(
        VALIDATION.PASSWORD_MIN_LENGTH,
      );
    });

    it('should have reasonable username constraints', () => {
      expect(VALIDATION.USERNAME_MIN_LENGTH).toBeGreaterThanOrEqual(3);
      expect(VALIDATION.USERNAME_MAX_LENGTH).toBeGreaterThan(
        VALIDATION.USERNAME_MIN_LENGTH,
      );
    });

    it('should have max file size', () => {
      expect(VALIDATION.MAX_FILE_SIZE).toBeGreaterThan(0);
    });

    it('should have allowed image types', () => {
      expect(VALIDATION.ALLOWED_IMAGE_TYPES).toContain('image/jpeg');
      expect(VALIDATION.ALLOWED_IMAGE_TYPES).toContain('image/png');
      expect(VALIDATION.ALLOWED_IMAGE_TYPES).toContain('image/gif');
      expect(VALIDATION.ALLOWED_IMAGE_TYPES).toContain('image/webp');
    });
  });

  describe('CURRENCY', () => {
    it('should have default currency', () => {
      expect(CURRENCY.DEFAULT).toBe('SEK');
    });

    it('should have currency symbols', () => {
      expect(CURRENCY.SYMBOLS.SEK).toBeDefined();
      expect(CURRENCY.SYMBOLS.EUR).toBe('€');
      expect(CURRENCY.SYMBOLS.USD).toBe('$');
      expect(CURRENCY.SYMBOLS.GBP).toBe('£');
    });
  });

  describe('DEFAULT_FEATURES', () => {
    it('should have feature flags', () => {
      expect(typeof DEFAULT_FEATURES.DARK_MODE).toBe('boolean');
      expect(typeof DEFAULT_FEATURES.SEARCH).toBe('boolean');
      expect(typeof DEFAULT_FEATURES.AUTHENTICATION).toBe('boolean');
      expect(typeof DEFAULT_FEATURES.CART).toBe('boolean');
    });
  });

  describe('ENV', () => {
    describe('isDevelopment', () => {
      beforeEach(() => {
        vi.stubEnv('NODE_ENV', 'development');
      });

      afterEach(() => {
        vi.unstubAllEnvs();
      });

      it('should return true in development', () => {
        expect(ENV.isDevelopment()).toBe(true);
      });
    });

    describe('isProduction', () => {
      beforeEach(() => {
        vi.stubEnv('NODE_ENV', 'production');
      });

      afterEach(() => {
        vi.unstubAllEnvs();
      });

      it('should return true in production', () => {
        expect(ENV.isProduction()).toBe(true);
      });
    });

    describe('isTest', () => {
      beforeEach(() => {
        vi.stubEnv('NODE_ENV', 'test');
      });

      afterEach(() => {
        vi.unstubAllEnvs();
      });

      it('should return true in test', () => {
        expect(ENV.isTest()).toBe(true);
      });
    });

    describe('isClient', () => {
      it('should return boolean based on window presence', () => {
        expect(typeof ENV.isClient()).toBe('boolean');
      });
    });

    describe('isServer', () => {
      it('should return opposite of isClient', () => {
        expect(ENV.isServer()).toBe(!ENV.isClient());
      });
    });
  });
});

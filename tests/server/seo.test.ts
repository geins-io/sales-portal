import { describe, it, expect } from 'vitest';
import { buildSiteUrl, isIndexable } from '../../server/utils/seo';

describe('SEO utilities', () => {
  describe('buildSiteUrl', () => {
    it('returns https URL from hostname', () => {
      expect(buildSiteUrl('shop.example.com')).toBe('https://shop.example.com');
    });

    it('handles localhost', () => {
      expect(buildSiteUrl('localhost')).toBe('https://localhost');
    });
  });

  describe('isIndexable', () => {
    it('returns true for "index, follow"', () => {
      expect(isIndexable('index, follow')).toBe(true);
    });

    it('returns false for "noindex"', () => {
      expect(isIndexable('noindex')).toBe(false);
    });

    it('returns false for "noindex, nofollow"', () => {
      expect(isIndexable('noindex, nofollow')).toBe(false);
    });

    it('returns true for null', () => {
      expect(isIndexable(null)).toBe(true);
    });

    it('returns true for undefined', () => {
      expect(isIndexable(undefined)).toBe(true);
    });
  });
});

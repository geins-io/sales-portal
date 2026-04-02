import { describe, it, expect } from 'vitest';
import {
  isTrustedOrigin,
  isValidCmsMessage,
} from '../../app/plugins/cms-preview-listener.client';

describe('cms-preview-listener', () => {
  describe('isTrustedOrigin', () => {
    it('accepts studio.geins.io', () => {
      expect(isTrustedOrigin('https://studio.geins.io')).toBe(true);
    });

    it('accepts any *.geins.io subdomain', () => {
      expect(isTrustedOrigin('https://admin.geins.io')).toBe(true);
      expect(isTrustedOrigin('https://cms.geins.io')).toBe(true);
      expect(isTrustedOrigin('https://foo.geins.io')).toBe(true);
    });

    it('accepts *.litium.io subdomains', () => {
      expect(isTrustedOrigin('https://orange.litium.io')).toBe(true);
      expect(isTrustedOrigin('https://admin.litium.io')).toBe(true);
    });

    it('rejects untrusted origins', () => {
      expect(isTrustedOrigin('https://evil.com')).toBe(false);
      expect(isTrustedOrigin('https://geins.io.evil.com')).toBe(false);
      expect(isTrustedOrigin('http://localhost:3000')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isTrustedOrigin('')).toBe(false);
    });
  });

  describe('isValidCmsMessage', () => {
    it('accepts valid cms: prefixed message', () => {
      expect(isValidCmsMessage({ type: 'cms:refresh-area' })).toBe(true);
      expect(
        isValidCmsMessage({
          type: 'cms:navigate',
          data: { path: '/products' },
        }),
      ).toBe(true);
    });

    it('accepts message with data object', () => {
      expect(
        isValidCmsMessage({
          type: 'cms:refresh-area',
          data: { family: 'Frontpage', areaName: 'Content' },
        }),
      ).toBe(true);
    });

    it('rejects non-cms prefixed messages', () => {
      expect(isValidCmsMessage({ type: 'other:message' })).toBe(false);
      expect(isValidCmsMessage({ type: 'refresh' })).toBe(false);
    });

    it('rejects non-object payloads', () => {
      expect(isValidCmsMessage(null)).toBe(false);
      expect(isValidCmsMessage(undefined)).toBe(false);
      expect(isValidCmsMessage('string')).toBe(false);
      expect(isValidCmsMessage(42)).toBe(false);
    });

    it('rejects objects without type field', () => {
      expect(isValidCmsMessage({ data: {} })).toBe(false);
      expect(isValidCmsMessage({})).toBe(false);
    });

    it('rejects objects with non-string type', () => {
      expect(isValidCmsMessage({ type: 42 })).toBe(false);
      expect(isValidCmsMessage({ type: null })).toBe(false);
    });
  });
});

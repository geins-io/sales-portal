import { describe, it, expect } from 'vitest';
import { encodeRedirectPath } from '../../../server/utils/redirect-path';

describe('encodeRedirectPath', () => {
  it('percent-encodes the characters h3 has decoded', () => {
    expect(encodeRedirectPath('/se/sv/p/stol-åäö')).toBe(
      '/se/sv/p/stol-%C3%A5%C3%A4%C3%B6',
    );
    expect(encodeRedirectPath('/se/sv/s/röd stol')).toBe(
      '/se/sv/s/r%C3%B6d%20stol',
    );
  });

  it('keeps the escapes h3 leaves encoded instead of encoding them again', () => {
    expect(encodeRedirectPath('/se/sv/p/a%2Fb')).toBe('/se/sv/p/a%2Fb');
    expect(encodeRedirectPath('/se/sv/p/100%25')).toBe('/se/sv/p/100%25');
  });

  it('encodes a percent sign that does not start an escape', () => {
    expect(encodeRedirectPath('/se/sv/p/a%2Gb')).toBe('/se/sv/p/a%252Gb');
  });

  it('leaves an ASCII path and its query string as they are', () => {
    expect(encodeRedirectPath('/se/sv/c/kategori-1?sort=price&page=2')).toBe(
      '/se/sv/c/kategori-1?sort=price&page=2',
    );
  });
});

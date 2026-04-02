import { describe, it, expect } from 'vitest';

// Import the pure validation function exported from the login page
import { isValidRedirect } from '../../../app/pages/login.vue';

describe('login page — isValidRedirect', () => {
  it('accepts a simple relative path', () => {
    expect(isValidRedirect('/dashboard')).toBe(true);
  });

  it('accepts a nested relative path', () => {
    expect(isValidRedirect('/se/en/products/123')).toBe(true);
  });

  it('accepts root path', () => {
    expect(isValidRedirect('/')).toBe(true);
  });

  it('accepts path with query string', () => {
    expect(isValidRedirect('/products?page=2')).toBe(true);
  });

  it('accepts path with hash', () => {
    expect(isValidRedirect('/page#section')).toBe(true);
  });

  it('rejects absolute URL with https protocol', () => {
    expect(isValidRedirect('https://evil.com')).toBe(false);
  });

  it('rejects absolute URL with http protocol', () => {
    expect(isValidRedirect('http://evil.com')).toBe(false);
  });

  it('rejects protocol-relative URL (//)', () => {
    expect(isValidRedirect('//evil.com')).toBe(false);
  });

  it('rejects path containing :// anywhere', () => {
    expect(isValidRedirect('/foo://bar')).toBe(false);
  });

  it('rejects path containing // anywhere', () => {
    expect(isValidRedirect('/foo//bar')).toBe(false);
  });

  it('rejects path not starting with /', () => {
    expect(isValidRedirect('evil.com/path')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidRedirect('')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidRedirect(undefined)).toBe(false);
  });

  it('rejects null', () => {
    expect(isValidRedirect(null)).toBe(false);
  });

  it('rejects non-string types', () => {
    expect(isValidRedirect(42)).toBe(false);
    expect(isValidRedirect(true)).toBe(false);
    expect(isValidRedirect({})).toBe(false);
  });
});

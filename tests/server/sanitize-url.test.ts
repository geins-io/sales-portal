import { describe, it, expect } from 'vitest';
import { sanitizeUrl, escapeCssString } from '../../server/utils/sanitize';

describe('sanitizeUrl', () => {
  it('accepts https:// URLs', () => {
    expect(sanitizeUrl('https://example.com/logo.png')).toBe(
      'https://example.com/logo.png',
    );
  });

  it('accepts data:image/ URIs', () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgo=';
    expect(sanitizeUrl(dataUri)).toBe(dataUri);
  });

  it('accepts data:image/svg+xml URIs', () => {
    const dataUri = 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E';
    expect(sanitizeUrl(dataUri)).toBe(dataUri);
  });

  it('rejects javascript: URIs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects data:text/html URIs', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('rejects http:// URLs', () => {
    expect(sanitizeUrl('http://example.com/logo.png')).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(sanitizeUrl('not a url at all')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(sanitizeUrl('')).toBeNull();
  });

  it('HTML-escapes the output', () => {
    const result = sanitizeUrl('https://example.com/path?a=1&b=2');
    expect(result).toContain('&amp;');
    expect(result).not.toContain('&b=');
  });

  it('rejects ftp:// URLs', () => {
    expect(sanitizeUrl('ftp://example.com/file')).toBeNull();
  });

  it('rejects data: URIs that are not data:image/', () => {
    expect(sanitizeUrl('data:application/json,{}')).toBeNull();
  });
});

describe('escapeCssString', () => {
  it('passes through normal font names', () => {
    expect(escapeCssString('Inter')).toBe('Inter');
  });

  it('preserves spaces and hyphens', () => {
    expect(escapeCssString('Open Sans')).toBe('Open Sans');
    expect(escapeCssString('Fira-Code')).toBe('Fira-Code');
  });

  it('strips single quotes', () => {
    expect(escapeCssString("'; --evil: x; '")).toBe(' --evil x ');
  });

  it('strips semicolons and braces', () => {
    expect(escapeCssString('font; } .evil { color: red')).toBe(
      'font  evil  color red',
    );
  });

  it('strips backslashes and special characters', () => {
    expect(escapeCssString('Roboto\\Mono')).toBe('RobotoMono');
  });

  it('returns empty string for all-special input', () => {
    expect(escapeCssString("';{}@#$%^")).toBe('');
  });
});

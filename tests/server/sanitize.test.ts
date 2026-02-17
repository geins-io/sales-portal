import { describe, it, expect } from 'vitest';
import {
  sanitizeTenantCss,
  sanitizeHtmlAttr,
} from '../../server/utils/sanitize';

describe('sanitizeTenantCss', () => {
  it('strips <script> tags', () => {
    const input = 'body { color: red; }<script>alert("xss")</script>';
    expect(sanitizeTenantCss(input)).toBe('body { color: red; }');
  });

  it('strips <style> tags', () => {
    const input = '<style>body { color: red; }</style>';
    expect(sanitizeTenantCss(input)).toBe('body { color: red; }');
  });

  it('strips all HTML tags', () => {
    const input = '<div>body { color: red; }</div><img src=x onerror=alert(1)>';
    expect(sanitizeTenantCss(input)).toBe('body { color: red; }');
  });

  it('strips @import url(evil.com)', () => {
    const input = '@import url(evil.com); body { color: red; }';
    expect(sanitizeTenantCss(input)).toBe('body { color: red; }');
  });

  it('strips @import with quoted url', () => {
    const input =
      '@import url("https://evil.com/steal.css"); .a { color: red; }';
    expect(sanitizeTenantCss(input)).toBe('.a { color: red; }');
  });

  it('strips @charset', () => {
    const input = '@charset "UTF-8"; body { color: red; }';
    expect(sanitizeTenantCss(input)).toBe('body { color: red; }');
  });

  it('strips @namespace', () => {
    const input =
      '@namespace url("http://www.w3.org/1999/xhtml"); body { color: red; }';
    expect(sanitizeTenantCss(input)).toBe('body { color: red; }');
  });

  it('strips expression()', () => {
    const input = 'div { width: expression(document.body.clientWidth); }';
    expect(sanitizeTenantCss(input)).toBe('div { width: ; }');
  });

  it('strips expression() with nested parens', () => {
    const input = 'div { width: expression(alert(1)); }';
    const result = sanitizeTenantCss(input);
    expect(result).not.toContain('expression');
  });

  it('strips url(javascript:...)', () => {
    const input = 'div { background: url(javascript:alert(1)); }';
    expect(sanitizeTenantCss(input)).toBe('div { background: ; }');
  });

  it('strips -moz-binding', () => {
    const input = 'div { -moz-binding: url("http://evil.com/xbl"); }';
    expect(sanitizeTenantCss(input)).toBe('div {  }');
  });

  it('strips behavior:', () => {
    const input = 'div { behavior: url(script.htc); }';
    expect(sanitizeTenantCss(input)).toBe('div {  }');
  });

  it('preserves url() with https:', () => {
    const input = 'div { background: url("https://cdn.example.com/bg.png"); }';
    expect(sanitizeTenantCss(input)).toBe(input);
  });

  it('preserves url() with safe data:image/', () => {
    const input =
      'div { background: url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E"); }';
    expect(sanitizeTenantCss(input)).toBe(input);
  });

  it('strips url() with data:text/html', () => {
    const input = 'div { background: url("data:text/html,payload"); }';
    const result = sanitizeTenantCss(input);
    expect(result).not.toContain('url(');
    expect(result).not.toContain('data:text/html');
  });

  it('strips url() with relative paths', () => {
    const input = 'div { background: url(../evil.css); }';
    expect(sanitizeTenantCss(input)).toBe('div { background: ; }');
  });

  it('strips url() with http://', () => {
    const input = 'div { background: url("http://evil.com/bg.png"); }';
    const result = sanitizeTenantCss(input);
    expect(result).not.toContain('url(');
    expect(result).not.toContain('http://evil.com');
  });

  it('preserves valid oklch() values', () => {
    const input = ':root { --primary: oklch(0.7 0.15 250); }';
    expect(sanitizeTenantCss(input)).toBe(input);
  });

  it('preserves valid [data-theme] selectors', () => {
    const input = '[data-theme="dark"] { --bg: #000; }';
    expect(sanitizeTenantCss(input)).toBe(input);
  });

  it('preserves var(--token) values', () => {
    const input = 'body { color: var(--text-primary); }';
    expect(sanitizeTenantCss(input)).toBe(input);
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeTenantCss('')).toBe('');
  });

  it('trims whitespace', () => {
    expect(sanitizeTenantCss('  body { color: red; }  ')).toBe(
      'body { color: red; }',
    );
  });
});

describe('sanitizeHtmlAttr', () => {
  it('escapes double quotes', () => {
    expect(sanitizeHtmlAttr('a"b')).toBe('a&quot;b');
  });

  it('escapes <', () => {
    expect(sanitizeHtmlAttr('a<b')).toBe('a&lt;b');
  });

  it('escapes >', () => {
    expect(sanitizeHtmlAttr('a>b')).toBe('a&gt;b');
  });

  it('escapes &', () => {
    expect(sanitizeHtmlAttr('a&b')).toBe('a&amp;b');
  });

  it('escapes single quotes', () => {
    expect(sanitizeHtmlAttr("a'b")).toBe('a&#39;b');
  });

  it('escapes all special characters together', () => {
    expect(sanitizeHtmlAttr('"<>&\'')).toBe('&quot;&lt;&gt;&amp;&#39;');
  });

  it('passes through safe strings unchanged', () => {
    expect(sanitizeHtmlAttr('my-theme')).toBe('my-theme');
  });
});

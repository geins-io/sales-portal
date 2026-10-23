import { describe, it, expect } from 'vitest';
import { toAbsoluteUrl } from '../../app/utils/absolute-url';

describe('toAbsoluteUrl', () => {
  it('prefixes an app path with the site URL', () => {
    expect(toAbsoluteUrl('/se/sv/p/stol', 'https://shop.example')).toBe(
      'https://shop.example/se/sv/p/stol',
    );
  });

  it('keeps the trailing slash of a locale root', () => {
    expect(toAbsoluteUrl('/se/sv/', 'https://shop.example')).toBe(
      'https://shop.example/se/sv/',
    );
  });

  it('does not double the slash when the site URL ends with one', () => {
    expect(toAbsoluteUrl('/se/sv/', 'https://shop.example/')).toBe(
      'https://shop.example/se/sv/',
    );
  });

  it('adds the slash a path without one is missing', () => {
    expect(toAbsoluteUrl('se/sv/', 'https://shop.example')).toBe(
      'https://shop.example/se/sv/',
    );
  });

  it('leaves the path encoding and query as they are', () => {
    expect(
      toAbsoluteUrl('/se/sv/s/r%C3%B6d%20stol?page=2', 'https://shop.example'),
    ).toBe('https://shop.example/se/sv/s/r%C3%B6d%20stol?page=2');
  });

  it('returns the path unchanged when there is no site URL', () => {
    expect(toAbsoluteUrl('/se/sv/', '')).toBe('/se/sv/');
    expect(toAbsoluteUrl('/se/sv/', undefined)).toBe('/se/sv/');
  });

  it('returns a URL that is already absolute unchanged', () => {
    expect(
      toAbsoluteUrl('https://other.example/se/sv/', 'https://shop.example'),
    ).toBe('https://other.example/se/sv/');
  });

  it('treats a URL inside the query as part of the path', () => {
    expect(
      toAbsoluteUrl(
        '/se/sv/login?redirect=https://x.example/',
        'https://shop.example',
      ),
    ).toBe('https://shop.example/se/sv/login?redirect=https://x.example/');
  });

  it('recognises a scheme with digits as absolute', () => {
    expect(toAbsoluteUrl('s3://bucket/key', 'https://shop.example')).toBe(
      's3://bucket/key',
    );
  });

  it('strips every trailing slash of the site URL', () => {
    expect(toAbsoluteUrl('/se/sv/', 'https://shop.example//')).toBe(
      'https://shop.example/se/sv/',
    );
  });
});

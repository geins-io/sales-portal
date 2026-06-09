import { describe, it, expect } from 'vitest';
import { CmsPageLinkSchema } from '../../../server/schemas/api-input';

describe('CmsPageLinkSchema', () => {
  it('accepts a valid lowercase slug', () => {
    expect(CmsPageLinkSchema.parse({ tag: 'contact' })).toEqual({
      tag: 'contact',
    });
  });

  it('accepts slugs with digits and hyphens', () => {
    expect(() =>
      CmsPageLinkSchema.parse({ tag: 'apply-for-account' }),
    ).not.toThrow();
    expect(() => CmsPageLinkSchema.parse({ tag: 'page2' })).not.toThrow();
  });

  it('rejects a hash-prefixed tag', () => {
    expect(() => CmsPageLinkSchema.parse({ tag: '#menu' })).toThrow();
  });

  it('rejects an uppercase tag', () => {
    expect(() => CmsPageLinkSchema.parse({ tag: 'Contact' })).toThrow();
  });

  it('rejects an empty string', () => {
    expect(() => CmsPageLinkSchema.parse({ tag: '' })).toThrow();
  });

  it('rejects a tag longer than 50 characters', () => {
    expect(() =>
      CmsPageLinkSchema.parse({ tag: 'a'.repeat(51) }),
    ).toThrow();
  });

  it('rejects a tag with a space', () => {
    expect(() => CmsPageLinkSchema.parse({ tag: 'has space' })).toThrow();
  });
});

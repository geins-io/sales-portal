import { describe, it, expect } from 'vitest';
import { hasPageTag } from '../../shared/utils/cms-tags';
import { CMS_TAGS } from '../../shared/constants/cms';

describe('hasPageTag', () => {
  it('matches a hashtag-prefixed tag from the CMS', () => {
    expect(hasPageTag({ tags: ['#menu'] }, CMS_TAGS.SIDEBAR_MENU)).toBe(true);
  });

  it('matches a non-prefixed tag', () => {
    expect(hasPageTag({ tags: ['menu'] }, 'menu')).toBe(true);
  });

  it('is case-insensitive on both sides', () => {
    expect(hasPageTag({ tags: ['#MENU'] }, 'menu')).toBe(true);
    expect(hasPageTag({ tags: ['#menu'] }, 'MENU')).toBe(true);
  });

  it('tolerates whitespace and double hashes', () => {
    expect(hasPageTag({ tags: ['  ##menu '] }, 'menu')).toBe(true);
  });

  it('does not match an unrelated tag', () => {
    expect(hasPageTag({ tags: ['#promo'] }, 'menu')).toBe(false);
    expect(hasPageTag({ tags: ['#menubar'] }, 'menu')).toBe(false);
  });

  it('returns false when tags are missing or empty', () => {
    expect(hasPageTag({ tags: [] }, 'menu')).toBe(false);
    expect(hasPageTag({}, 'menu')).toBe(false);
    expect(hasPageTag(null, 'menu')).toBe(false);
    expect(hasPageTag(undefined, 'menu')).toBe(false);
  });

  it('returns false for an empty target tag', () => {
    expect(hasPageTag({ tags: ['#menu'] }, '')).toBe(false);
    expect(hasPageTag({ tags: ['#menu'] }, '#')).toBe(false);
  });
});

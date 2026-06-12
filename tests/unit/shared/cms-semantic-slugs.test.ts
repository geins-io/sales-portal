import { describe, it, expect } from 'vitest';
import {
  CMS_SEMANTIC_SLUGS,
  CMS_SEMANTIC_SLUG_KEYS,
  cmsTagForSlug,
  CMS_TAGS,
} from '../../../shared/constants/cms';

describe('CMS_SEMANTIC_SLUGS map contents', () => {
  it('maps terms to CMS_TAGS.TERMS_PAGE', () => {
    expect(CMS_SEMANTIC_SLUGS['terms']).toBe(CMS_TAGS.TERMS_PAGE);
  });

  it('maps contact to CMS_TAGS.CONTACT_PAGE', () => {
    expect(CMS_SEMANTIC_SLUGS['contact']).toBe(CMS_TAGS.CONTACT_PAGE);
  });

  it('maps contact-form to CMS_TAGS.CONTACT_PAGE', () => {
    expect(CMS_SEMANTIC_SLUGS['contact-form']).toBe(CMS_TAGS.CONTACT_PAGE);
  });

  it('maps apply to CMS_TAGS.APPLY_PAGE', () => {
    expect(CMS_SEMANTIC_SLUGS['apply']).toBe(CMS_TAGS.APPLY_PAGE);
  });

  it('maps apply-for-account to CMS_TAGS.APPLY_PAGE', () => {
    expect(CMS_SEMANTIC_SLUGS['apply-for-account']).toBe(CMS_TAGS.APPLY_PAGE);
  });

  it('every value is one of the CMS_TAGS values', () => {
    const tagValues = Object.values(CMS_TAGS) as string[];
    for (const value of Object.values(CMS_SEMANTIC_SLUGS)) {
      expect(tagValues).toContain(value);
    }
  });
});

describe('CMS_SEMANTIC_SLUG_KEYS', () => {
  it('contains exactly the five expected slug keys', () => {
    expect([...CMS_SEMANTIC_SLUG_KEYS].sort()).toEqual(
      ['apply', 'apply-for-account', 'contact', 'contact-form', 'terms'].sort(),
    );
  });
});

describe('cmsTagForSlug', () => {
  it('returns TERMS_PAGE for bare slug terms', () => {
    expect(cmsTagForSlug('terms')).toBe(CMS_TAGS.TERMS_PAGE);
  });

  it('returns TERMS_PAGE for /terms (leading slash tolerated)', () => {
    expect(cmsTagForSlug('/terms')).toBe(CMS_TAGS.TERMS_PAGE);
  });

  it('returns TERMS_PAGE for /terms/ (trailing slash tolerated)', () => {
    expect(cmsTagForSlug('/terms/')).toBe(CMS_TAGS.TERMS_PAGE);
  });

  it('returns APPLY_PAGE for full path /se/sv/apply-for-account (last segment used)', () => {
    expect(cmsTagForSlug('/se/sv/apply-for-account')).toBe(CMS_TAGS.APPLY_PAGE);
  });

  it('returns CONTACT_PAGE for CONTACT-FORM (case-insensitive)', () => {
    expect(cmsTagForSlug('CONTACT-FORM')).toBe(CMS_TAGS.CONTACT_PAGE);
  });

  it('returns null for unknown-page', () => {
    expect(cmsTagForSlug('unknown-page')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(cmsTagForSlug('')).toBeNull();
  });

  it('returns null for a single slash', () => {
    expect(cmsTagForSlug('/')).toBeNull();
  });

  it('does not match a substring of a known slug (contacts does not match contact)', () => {
    expect(cmsTagForSlug('contacts')).toBeNull();
  });

  it('normalizes mixed-case and surrounding whitespace', () => {
    expect(cmsTagForSlug('  Terms  ')).toBe(CMS_TAGS.TERMS_PAGE);
  });

  // B1: prototype-pollution resistance
  it('returns null for __proto__ (prototype-pollution guard)', () => {
    expect(cmsTagForSlug('__proto__')).toBeNull();
  });

  it('returns null for constructor (prototype-pollution guard)', () => {
    expect(cmsTagForSlug('constructor')).toBeNull();
  });

  it('returns null for a path whose last segment is constructor', () => {
    expect(cmsTagForSlug('/se/sv/constructor')).toBeNull();
  });

  it('returns null for CONSTRUCTOR (case-folded prototype-pollution guard)', () => {
    expect(cmsTagForSlug('CONSTRUCTOR')).toBeNull();
  });

  // N3: non-string input returns null
  it('returns null for non-string input (number)', () => {
    expect(cmsTagForSlug(42 as unknown as string)).toBeNull();
  });

  it('returns null for non-string input (null)', () => {
    expect(cmsTagForSlug(null as unknown as string)).toBeNull();
  });

  it('returns null for non-string input (undefined)', () => {
    expect(cmsTagForSlug(undefined as unknown as string)).toBeNull();
  });

  // N3: query-string and hash stripping
  it('resolves /terms?utm=x to TERMS_PAGE (query stripped before lookup)', () => {
    expect(cmsTagForSlug('/terms?utm=x')).toBe(CMS_TAGS.TERMS_PAGE);
  });

  it('resolves /terms#section to TERMS_PAGE (hash stripped before lookup)', () => {
    expect(cmsTagForSlug('/terms#section')).toBe(CMS_TAGS.TERMS_PAGE);
  });

  it('resolves /contact-form?ref=nav to CONTACT_PAGE (query stripped)', () => {
    expect(cmsTagForSlug('/contact-form?ref=nav')).toBe(CMS_TAGS.CONTACT_PAGE);
  });
});

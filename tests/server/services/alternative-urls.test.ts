import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { LocaleAlternateUrl } from '../../../shared/types/commerce';

const ROOT = resolve(__dirname, '../../..');

function readGraphql(relativePath: string): string {
  return readFileSync(
    join(ROOT, 'server/services/graphql', relativePath),
    'utf-8',
  );
}

const ALTERNATE_FIELDS = [
  'language',
  'culture',
  'country',
  'url',
  'channelId',
] as const;

describe('alternativeUrls GraphQL contract', () => {
  it('product query selects alternativeUrls with language/culture/country/url/channelId', () => {
    const query = readGraphql('products/product.graphql');

    expect(query).toContain('alternativeUrls');
    const block = query.slice(query.indexOf('alternativeUrls'));
    for (const field of ALTERNATE_FIELDS) {
      expect(block).toContain(field);
    }
  });

  it('ListInfo fragment selects alternativeUrls with all five fields', () => {
    const fragment = readGraphql('fragments/list-info.graphql');

    expect(fragment).toContain('alternativeUrls');
    const block = fragment.slice(fragment.indexOf('alternativeUrls'));
    for (const field of ALTERNATE_FIELDS) {
      expect(block).toContain(field);
    }
  });

  it('category-page and brand-page compose ListInfo (so they inherit alternativeUrls)', () => {
    expect(readGraphql('product-lists/category-page.graphql')).toContain(
      '...ListInfo',
    );
    expect(readGraphql('product-lists/brand-page.graphql')).toContain(
      '...ListInfo',
    );
  });
});

describe('LocaleAlternateUrl type shape', () => {
  it('round-trips a fully populated alternate url literal', () => {
    const alt: LocaleAlternateUrl = {
      language: 'en',
      culture: 'en-US',
      country: 'US',
      url: '/se/en/p/cutting-edge',
      channelId: '1',
    };

    const obj: { alternativeUrls?: LocaleAlternateUrl[] } = {
      alternativeUrls: [alt],
    };

    expect(obj.alternativeUrls?.[0].culture).toBe('en-US');
    expect(obj.alternativeUrls?.[0].url).toBe('/se/en/p/cutting-edge');
  });

  it('allows a null country', () => {
    const alt: LocaleAlternateUrl = {
      language: 'en',
      culture: 'en-US',
      country: null,
      url: '/se/en/c/category-1',
      channelId: '1',
    };

    expect(alt.country).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import type { DetailProduct } from '../../shared/types/commerce';
import {
  configuratorTabs,
  defaultProductTab,
  hasRenderableHtml,
  productDescriptionTexts,
  visibleParameterGroups,
} from '../../app/utils/product-tabs';

describe('hasRenderableHtml', () => {
  it('accepts markup that carries visible copy', () => {
    expect(hasRenderableHtml('<p>Bredd 1400 mm</p>')).toBe(true);
  });

  it('rejects an empty editor paragraph, which would render a blank block', () => {
    expect(hasRenderableHtml('<p><br></p>')).toBe(false);
  });

  it('rejects nothing at all', () => {
    expect(hasRenderableHtml(undefined)).toBe(false);
    expect(hasRenderableHtml('')).toBe(false);
  });
});

describe('productDescriptionTexts', () => {
  // The Merchant API returns the PIM boxes cyclically offset, so box 2 arrives
  // as `text1` and box 3 as `text2` (see ~/utils/product-texts).
  function product(texts: Record<string, string>): DetailProduct {
    return { texts } as unknown as DetailProduct;
  }

  it('reads the two admin boxes the description tab shows', () => {
    expect(
      productDescriptionTexts(
        product({ text1: '<p>box two</p>', text2: '<p>box three</p>' }),
      ),
    ).toEqual({ text2: '<p>box two</p>', text3: '<p>box three</p>' });
  });

  it('drops a box that holds only empty markup', () => {
    expect(
      productDescriptionTexts(product({ text1: '<p></p>', text2: '<p>x</p>' })),
    ).toEqual({ text2: undefined, text3: '<p>x</p>' });
  });
});

describe('visibleParameterGroups', () => {
  const group = (name: string, parameters: unknown[]) =>
    ({ name, parameterGroupId: 1, parameters }) as never;

  it('hides the Monitor group, whatever its casing', () => {
    expect(
      visibleParameterGroups([
        group('monitor', [{ name: 'a', value: '1' }]),
        group('MONITOR', [{ name: 'b', value: '2' }]),
      ]),
    ).toEqual([]);
  });

  it('hides only the group named exactly Monitor', () => {
    const groups = visibleParameterGroups([
      group('Monitorstativ', [{ name: 'Höjd', value: '40 cm' }]),
      group('Extern monitor', [{ name: 'Tum', value: '27' }]),
      group('Monitor', [{ name: 'Intern', value: 'x' }]),
    ]);

    expect(groups.map((g) => g.name)).toEqual([
      'Monitorstativ',
      'Extern monitor',
    ]);
  });

  it('drops parameters with no label or no value, and groups left empty', () => {
    const groups = visibleParameterGroups([
      group('Mått', [
        { name: 'Bredd', value: '1400 mm' },
        { name: 'Djup', value: null },
        { value: '900 mm' },
      ]),
      group('Tomt', [{ name: 'Höjd', value: undefined }]),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.parameters).toEqual([
      { name: 'Bredd', value: '1400 mm' },
    ]);
  });

  it('accepts a product with no groups at all', () => {
    expect(visibleParameterGroups(undefined)).toEqual([]);
  });
});

describe('defaultProductTab', () => {
  it('opens on the first tab that has content', () => {
    expect(
      defaultProductTab({
        hasDescription: true,
        hasSpecs: true,
        hasRelated: true,
      }),
    ).toBe('description');
    expect(
      defaultProductTab({
        hasDescription: false,
        hasSpecs: true,
        hasRelated: true,
      }),
    ).toBe('specifications');
    expect(
      defaultProductTab({
        hasDescription: false,
        hasSpecs: false,
        hasRelated: true,
      }),
    ).toBe('related');
  });

  it('falls back to documents, which every product has', () => {
    expect(
      defaultProductTab({
        hasDescription: false,
        hasSpecs: false,
        hasRelated: false,
      }),
    ).toBe('documents');
  });
});

describe('configuratorTabs', () => {
  it('puts the configuration first and keeps the ordinary order behind it', () => {
    expect(
      configuratorTabs({
        hasDescription: true,
        hasSpecs: true,
        hasRelated: true,
      }).map((tab) => tab.value),
    ).toEqual([
      'configuration',
      'description',
      'specifications',
      'documents',
      'related',
    ]);
  });

  it('keeps the configuration and documents when the product has nothing else', () => {
    expect(
      configuratorTabs({
        hasDescription: false,
        hasSpecs: false,
        hasRelated: false,
      }).map((tab) => tab.value),
    ).toEqual(['configuration', 'documents']);
  });

  it('names every tab through an i18n key, never a literal', () => {
    for (const tab of configuratorTabs({
      hasDescription: true,
      hasSpecs: true,
      hasRelated: true,
    })) {
      expect(tab.labelKey).toMatch(/^(product|configurator)\./);
    }
  });
});

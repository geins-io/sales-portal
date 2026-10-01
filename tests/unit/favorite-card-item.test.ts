import { describe, it, expect } from 'vitest';
import {
  toFavoriteCardItem,
  type FavoriteProduct,
} from '../../app/utils/favorite-card-item';

const ORDINARY: FavoriteProduct = {
  alias: 'wood-screw',
  name: 'Wood screw',
  articleNumber: 'WS-1',
  productImages: [{ fileName: 'screw.jpg' }, { fileName: 'second.jpg' }],
  unitPrice: {
    isDiscounted: false,
    regularPriceIncVat: 100,
    regularPriceIncVatFormatted: '100 kr',
    sellingPriceIncVat: 100,
    sellingPriceIncVatFormatted: '100 kr',
  },
};

describe('toFavoriteCardItem', () => {
  it('builds the card item of an ordinary product without the flag', () => {
    expect(toFavoriteCardItem(ORDINARY)).toStrictEqual({
      name: 'Wood screw',
      imageFileName: 'screw.jpg',
      price: '100 kr',
      salePrice: null,
      articleNumber: 'WS-1',
      alias: 'wood-screw',
    });
  });

  it('passes a configurable product’s flag through to the card', () => {
    expect(
      toFavoriteCardItem({ ...ORDINARY, configurable: true }),
    ).toMatchObject({ configurable: true });
  });

  it('shows a discounted price as the regular price struck by the selling one', () => {
    const item = toFavoriteCardItem({
      ...ORDINARY,
      unitPrice: {
        isDiscounted: true,
        regularPriceIncVat: 100,
        regularPriceIncVatFormatted: '100 kr',
        sellingPriceIncVat: 80,
        sellingPriceIncVatFormatted: '80 kr',
      },
    });

    expect(item.price).toBe('100 kr');
    expect(item.salePrice).toBe('80 kr');
  });

  it('treats a selling price below the regular one as a discount without the flag', () => {
    const item = toFavoriteCardItem({
      ...ORDINARY,
      unitPrice: {
        isDiscounted: false,
        regularPriceIncVat: 100,
        regularPriceIncVatFormatted: '100 kr',
        sellingPriceIncVat: 80,
        sellingPriceIncVatFormatted: '80 kr',
      },
    });

    expect(item.price).toBe('100 kr');
    expect(item.salePrice).toBe('80 kr');
  });

  it('shows no discount when the selling price equals the regular one', () => {
    const item = toFavoriteCardItem(ORDINARY);

    expect(item.price).toBe('100 kr');
    expect(item.salePrice).toBeNull();
  });

  it('shows the selling price when the regular one is missing', () => {
    const item = toFavoriteCardItem({
      ...ORDINARY,
      unitPrice: {
        sellingPriceIncVat: 80,
        sellingPriceIncVatFormatted: '80 kr',
      },
    });

    expect(item.price).toBe('80 kr');
    expect(item.salePrice).toBeNull();
  });

  it('shows no discount when the selling price is missing', () => {
    const item = toFavoriteCardItem({
      ...ORDINARY,
      unitPrice: {
        regularPriceIncVat: 100,
        regularPriceIncVatFormatted: '100 kr',
      },
    });

    expect(item.price).toBeNull();
    expect(item.salePrice).toBeNull();
  });

  it('follows the discount flag when the prices carry no amounts', () => {
    const item = toFavoriteCardItem({
      unitPrice: {
        isDiscounted: true,
        regularPriceIncVatFormatted: '100 kr',
        sellingPriceIncVatFormatted: '80 kr',
      },
    });

    expect(item.price).toBe('100 kr');
    expect(item.salePrice).toBe('80 kr');
  });

  it.each([[[]], [[null]]])(
    'gives no image when the first image is missing (%j)',
    (productImages) => {
      expect(
        toFavoriteCardItem({ ...ORDINARY, productImages }).imageFileName,
      ).toBeNull();
    },
  );

  it('falls back to empty values when the product carries nothing', () => {
    expect(toFavoriteCardItem({})).toStrictEqual({
      name: '',
      imageFileName: null,
      price: null,
      salePrice: null,
      articleNumber: null,
      alias: null,
    });
  });

  it('falls back to null prices on a discount that has no formatted prices', () => {
    const item = toFavoriteCardItem({
      unitPrice: { isDiscounted: true },
    });

    expect(item.price).toBeNull();
    expect(item.salePrice).toBeNull();
  });
});

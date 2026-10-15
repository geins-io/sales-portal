import { describe, it, expect } from 'vitest';
import {
  toFavoriteCardItem,
  type FavoriteProduct,
} from '../../app/utils/favorite-card-item';

const ORDINARY: FavoriteProduct = {
  alias: 'wood-screw',
  name: 'Wood screw',
  articleNumber: 'WS-1',
  productImages: [
    {
      fileName: 'screw.jpg',
      url: 'https://cdn.example.test/acme/products/screw.jpg',
    },
    { fileName: 'second.jpg', url: null },
  ],
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
    expect(toFavoriteCardItem(ORDINARY, true)).toStrictEqual({
      name: 'Wood screw',
      imageFileName: 'screw.jpg',
      imageUrl: 'https://cdn.example.test/acme/products/screw.jpg',
      price: '100 kr',
      salePrice: null,
      articleNumber: 'WS-1',
      alias: 'wood-screw',
    });
  });

  it('passes a configurable product’s flag through to the card', () => {
    expect(
      toFavoriteCardItem({ ...ORDINARY, configurable: true }, true),
    ).toMatchObject({ configurable: true });
  });

  it('shows a discounted price as the regular price struck by the selling one', () => {
    const item = toFavoriteCardItem(
      {
        ...ORDINARY,
        unitPrice: {
          isDiscounted: true,
          regularPriceIncVat: 100,
          regularPriceIncVatFormatted: '100 kr',
          sellingPriceIncVat: 80,
          sellingPriceIncVatFormatted: '80 kr',
        },
      },
      true,
    );

    expect(item.price).toBe('100 kr');
    expect(item.salePrice).toBe('80 kr');
  });

  it('treats a selling price below the regular one as a discount without the flag', () => {
    const item = toFavoriteCardItem(
      {
        ...ORDINARY,
        unitPrice: {
          isDiscounted: false,
          regularPriceIncVat: 100,
          regularPriceIncVatFormatted: '100 kr',
          sellingPriceIncVat: 80,
          sellingPriceIncVatFormatted: '80 kr',
        },
      },
      true,
    );

    expect(item.price).toBe('100 kr');
    expect(item.salePrice).toBe('80 kr');
  });

  it('shows no discount when the selling price equals the regular one', () => {
    const item = toFavoriteCardItem(ORDINARY, true);

    expect(item.price).toBe('100 kr');
    expect(item.salePrice).toBeNull();
  });

  it('shows the selling price when the regular one is missing', () => {
    const item = toFavoriteCardItem(
      {
        ...ORDINARY,
        unitPrice: {
          sellingPriceIncVat: 80,
          sellingPriceIncVatFormatted: '80 kr',
        },
      },
      true,
    );

    expect(item.price).toBe('80 kr');
    expect(item.salePrice).toBeNull();
  });

  it('shows no discount when the selling price is missing', () => {
    const item = toFavoriteCardItem(
      {
        ...ORDINARY,
        unitPrice: {
          regularPriceIncVat: 100,
          regularPriceIncVatFormatted: '100 kr',
        },
      },
      true,
    );

    expect(item.price).toBeNull();
    expect(item.salePrice).toBeNull();
  });

  it('follows the discount flag when the prices carry no amounts', () => {
    const item = toFavoriteCardItem(
      {
        unitPrice: {
          isDiscounted: true,
          regularPriceIncVatFormatted: '100 kr',
          sellingPriceIncVatFormatted: '80 kr',
        },
      },
      true,
    );

    expect(item.price).toBe('100 kr');
    expect(item.salePrice).toBe('80 kr');
  });

  it.each([[[]], [[null]]])(
    'gives no image when the first image is missing (%j)',
    (productImages) => {
      const item = toFavoriteCardItem({ ...ORDINARY, productImages }, true);

      expect(item.imageFileName).toBeNull();
      expect(item.imageUrl).toBeNull();
    },
  );

  it('gives a legacy image its file name and no library url', () => {
    const item = toFavoriteCardItem(
      { ...ORDINARY, productImages: [{ fileName: 'old.jpg', url: null }] },
      true,
    );

    expect(item.imageFileName).toBe('old.jpg');
    expect(item.imageUrl).toBeNull();
  });

  it('falls back to empty values when the product carries nothing', () => {
    expect(toFavoriteCardItem({}, true)).toStrictEqual({
      name: '',
      imageFileName: null,
      imageUrl: null,
      price: null,
      salePrice: null,
      articleNumber: null,
      alias: null,
    });
  });

  it('falls back to null prices on a discount that has no formatted prices', () => {
    const item = toFavoriteCardItem(
      {
        unitPrice: { isDiscounted: true },
      },
      true,
    );

    expect(item.price).toBeNull();
    expect(item.salePrice).toBeNull();
  });

  describe('follows the VAT choice', () => {
    const BOTH: FavoriteProduct = {
      ...ORDINARY,
      unitPrice: {
        isDiscounted: true,
        regularPriceIncVat: 125,
        regularPriceIncVatFormatted: '125 kr',
        sellingPriceIncVat: 100,
        sellingPriceIncVatFormatted: '100 kr',
        regularPriceExVat: 100,
        regularPriceExVatFormatted: '100 kr ex',
        sellingPriceExVat: 80,
        sellingPriceExVatFormatted: '80 kr ex',
      },
    };

    it('shows the inc-VAT prices when inc is chosen', () => {
      const item = toFavoriteCardItem(BOTH, true);
      expect([item.price, item.salePrice]).toEqual(['125 kr', '100 kr']);
    });

    it('shows the ex-VAT prices when ex is chosen', () => {
      const item = toFavoriteCardItem(BOTH, false);
      expect([item.price, item.salePrice]).toEqual(['100 kr ex', '80 kr ex']);
    });

    it('decides the discount from the ex amounts when ex is chosen', () => {
      const item = toFavoriteCardItem(
        {
          unitPrice: {
            regularPriceExVat: 100,
            regularPriceExVatFormatted: '100 kr ex',
            sellingPriceExVat: 80,
            sellingPriceExVatFormatted: '80 kr ex',
          },
        },
        false,
      );
      expect([item.price, item.salePrice]).toEqual(['100 kr ex', '80 kr ex']);
    });

    it.each([[null], [undefined]])(
      'gives no prices when ex is chosen and the unit price is %s',
      (unitPrice) => {
        const item = toFavoriteCardItem({ ...ORDINARY, unitPrice }, false);
        expect([item.price, item.salePrice]).toEqual([null, null]);
      },
    );

    it('shows no price rather than the inc one when the ex price is missing', () => {
      const item = toFavoriteCardItem(ORDINARY, false);
      expect([item.price, item.salePrice]).toEqual([null, null]);
    });
  });
});

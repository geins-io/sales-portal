import { describe, it, expect } from 'vitest';
import { isShownAsDiscount } from '../../app/utils/price-discount';

describe('isShownAsDiscount', () => {
  it('shows a real discount', () => {
    expect(
      isShownAsDiscount({
        isDiscounted: true,
        regularPriceExVat: 239.2,
        sellingPriceExVat: 159.2,
      }),
    ).toBe(true);
  });

  it('hides a flag raised by a regular price with more decimals alone', () => {
    // Measured on a CPQ-enabled account: the regular price with more decimals.
    expect(
      isShownAsDiscount({
        isDiscounted: true,
        regularPriceExVat: 86.74170868,
        sellingPriceExVat: 86.74,
      }),
    ).toBe(false);
  });

  it('shows a difference of exactly half an öre', () => {
    expect(
      isShownAsDiscount({
        isDiscounted: true,
        regularPriceExVat: 10.005,
        sellingPriceExVat: 10,
      }),
    ).toBe(true);
  });

  it('shows half an öre on a large price, where the subtraction falls short', () => {
    expect(
      isShownAsDiscount({
        isDiscounted: true,
        regularPriceExVat: 10000.005,
        sellingPriceExVat: 10000,
      }),
    ).toBe(true);
  });

  it('shows a difference on the tolerance boundary itself', () => {
    expect(
      isShownAsDiscount({
        isDiscounted: true,
        regularPriceExVat: 0.004999999,
        sellingPriceExVat: 0,
      }),
    ).toBe(true);
  });

  it('hides a difference just under half an öre', () => {
    expect(
      isShownAsDiscount({
        isDiscounted: true,
        regularPriceExVat: 10.0049,
        sellingPriceExVat: 10,
      }),
    ).toBe(false);
  });

  it('hides equal prices with the flag up', () => {
    expect(
      isShownAsDiscount({
        isDiscounted: true,
        regularPriceExVat: 86.74,
        sellingPriceExVat: 86.74,
      }),
    ).toBe(false);
  });

  it('hides a selling price above the regular one', () => {
    expect(
      isShownAsDiscount({
        isDiscounted: true,
        regularPriceExVat: 100,
        sellingPriceExVat: 120,
      }),
    ).toBe(false);
  });

  it('never shows a discount the flag does not claim', () => {
    expect(
      isShownAsDiscount({
        isDiscounted: false,
        regularPriceExVat: 239.2,
        sellingPriceExVat: 159.2,
      }),
    ).toBe(false);
  });

  it('follows the flag when an ex-VAT price is missing', () => {
    expect(
      isShownAsDiscount({ isDiscounted: true, regularPriceExVat: 239.2 }),
    ).toBe(true);
    expect(
      isShownAsDiscount({ isDiscounted: true, sellingPriceExVat: 159.2 }),
    ).toBe(true);
    expect(isShownAsDiscount({ isDiscounted: false })).toBe(false);
  });

  it('shows nothing without a price', () => {
    expect(isShownAsDiscount(undefined)).toBe(false);
  });

  describe('a line total', () => {
    const total = (regular: number, selling: number) => ({
      isDiscounted: true,
      regularPriceExVat: regular,
      sellingPriceExVat: selling,
    });

    it('hides rounding that grew with the quantity', () => {
      expect(isShownAsDiscount(total(260.22512604, 260.22), 3)).toBe(false);
    });

    it('shows half an öre per unit', () => {
      expect(isShownAsDiscount(total(10.015, 10), 3)).toBe(true);
    });

    it('hides just under half an öre per unit', () => {
      expect(isShownAsDiscount(total(10.0149, 10), 3)).toBe(false);
    });

    it('shows a discount on the total alone', () => {
      expect(isShownAsDiscount(total(260.22, 240), 3)).toBe(true);
    });

    it('judges one unit when no quantity is given', () => {
      expect(isShownAsDiscount(total(260.22512604, 260.22))).toBe(true);
    });
  });
});

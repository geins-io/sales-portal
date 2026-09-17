import { describe, it, expect } from 'vitest';
import { resolveProductPageType } from '../../app/utils/product-page-type';

// ---------------------------------------------------------------------------
// Which page component a product gets.
//
// The choice is a pure function rather than a condition in the page so that
// every branch is testable and mutable — Stryker instruments a file before the
// Vue compiler runs, so nothing inside a `.vue` file can be mutation-tested.
//
// Two inputs, and both have to hold for the configurator: the product says it
// is configurable, and the access rule lets this buyer configure. A buyer the
// rule refuses gets the ordinary page, never a 404 — the product exists, it is
// only the configurator that is not offered.
// ---------------------------------------------------------------------------

describe('resolveProductPageType', () => {
  it('chooses the configurator for a configurable product when access holds', () => {
    expect(resolveProductPageType({ configurable: true }, true)).toBe(
      'configurable',
    );
  });

  it('chooses the ordinary page for a configurable product when access is refused', () => {
    expect(resolveProductPageType({ configurable: true }, false)).toBe(
      'ordinary',
    );
  });

  it('chooses the ordinary page for an ordinary product even when access holds', () => {
    expect(resolveProductPageType({ configurable: false }, true)).toBe(
      'ordinary',
    );
  });

  it('chooses the ordinary page when the product carries no flag at all', () => {
    expect(resolveProductPageType({}, true)).toBe('ordinary');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('chooses the ordinary page when the product is %s', (_label, product) => {
    expect(resolveProductPageType(product, true)).toBe('ordinary');
  });

  it('does not treat a truthy non-boolean flag as configurable', () => {
    // The flag is derived server-side and typed `boolean | undefined`. A value
    // that arrives as anything else is drift, and drift must not open a page.
    const product = { configurable: 'yes' } as unknown as {
      configurable?: boolean;
    };
    expect(resolveProductPageType(product, true)).toBe('ordinary');
  });
});

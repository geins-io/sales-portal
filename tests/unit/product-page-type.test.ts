import { describe, it, expect } from 'vitest';
import { resolveProductPageType } from '../../app/utils/product-page-type';

// ---------------------------------------------------------------------------
// Which page component a product gets.
//
// The choice is a pure function rather than a condition in the page so that
// every branch is testable and mutable — Stryker instruments a file before the
// Vue compiler runs, so nothing inside a `.vue` file can be mutation-tested.
//
// Configuring needs the configurator switched on and a signed-in buyer. A guest
// on a configurable product gets the page that asks them to sign in, never a
// plain add; with the configurator off the product is an ordinary one.
// ---------------------------------------------------------------------------

const ON = { enabled: true };
const OFF = { enabled: false };
const GUEST = { authenticated: false };
const SIGNED_IN = { authenticated: true };

describe('resolveProductPageType', () => {
  it('chooses the configurator for a configurable product and a signed-in buyer', () => {
    expect(resolveProductPageType({ configurable: true }, ON, SIGNED_IN)).toBe(
      'configurable',
    );
  });

  it('asks a guest to sign in on a configurable product', () => {
    expect(resolveProductPageType({ configurable: true }, ON, GUEST)).toBe(
      'sign-in-to-configure',
    );
  });

  it.each([
    ['off', OFF],
    ['absent', undefined],
  ])(
    'chooses the ordinary page for a configurable product when the configurator is %s',
    (_label, configurator) => {
      expect(
        resolveProductPageType({ configurable: true }, configurator, SIGNED_IN),
      ).toBe('ordinary');
      expect(
        resolveProductPageType({ configurable: true }, configurator, GUEST),
      ).toBe('ordinary');
    },
  );

  it("does not read the configurator's access rule", () => {
    const openToAll = { enabled: true, access: 'all' as const };
    const signedInOnly = { enabled: true, access: 'authenticated' as const };
    expect(
      resolveProductPageType({ configurable: true }, openToAll, GUEST),
    ).toBe('sign-in-to-configure');
    expect(
      resolveProductPageType({ configurable: true }, signedInOnly, SIGNED_IN),
    ).toBe('configurable');
  });

  it('chooses the ordinary page for an ordinary product, signed in or not', () => {
    expect(resolveProductPageType({ configurable: false }, ON, SIGNED_IN)).toBe(
      'ordinary',
    );
    expect(resolveProductPageType({ configurable: false }, ON, GUEST)).toBe(
      'ordinary',
    );
  });

  it('chooses the ordinary page when the product carries no flag at all', () => {
    expect(resolveProductPageType({}, ON, SIGNED_IN)).toBe('ordinary');
    expect(resolveProductPageType({}, ON, GUEST)).toBe('ordinary');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('chooses the ordinary page when the product is %s', (_label, product) => {
    expect(resolveProductPageType(product, ON, SIGNED_IN)).toBe('ordinary');
    expect(resolveProductPageType(product, ON, GUEST)).toBe('ordinary');
  });

  it('does not treat a truthy non-boolean flag as configurable', () => {
    // The flag is derived server-side and typed `boolean | undefined`. A value
    // that arrives as anything else is drift, and drift must not open a page.
    const product = { configurable: 'yes' } as unknown as {
      configurable?: boolean;
    };
    expect(resolveProductPageType(product, ON, SIGNED_IN)).toBe('ordinary');
    expect(resolveProductPageType(product, ON, GUEST)).toBe('ordinary');
  });
});

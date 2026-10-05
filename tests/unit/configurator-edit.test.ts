import { describe, it, expect } from 'vitest';
import { editLineHref, editTarget } from '../../app/utils/configurator-edit';

describe('editLineHref', () => {
  it('puts the cart and the line on the product path, as ids only', () => {
    expect(
      editLineHref('/se/sv/p/digging-bucket', {
        cartId: 'cart-1',
        itemId: 'item-1',
      }),
    ).toBe('/se/sv/p/digging-bucket?cart=cart-1&line=item-1');
  });

  it('encodes the ids', () => {
    expect(editLineHref('/p/x', { cartId: 'a b', itemId: 'c&d' })).toBe(
      '/p/x?cart=a+b&line=c%26d',
    );
  });
});

describe('editTarget', () => {
  const LINE = { cartId: 'cart-1', itemId: 'item-1' };

  it("names the line when the query's cart is the buyer's", () => {
    expect(editTarget({ cart: 'cart-1', line: 'item-1' }, 'cart-1')).toEqual({
      line: LINE,
      stale: false,
    });
  });

  it('names nothing on an ordinary product page', () => {
    expect(editTarget({}, 'cart-1')).toEqual({ line: null, stale: false });
    expect(editTarget({ other: 'x' }, null)).toEqual({
      line: null,
      stale: false,
    });
  });

  it.each([
    ['another cart', { cart: 'cart-2', line: 'item-1' }, 'cart-1'],
    ['no cart at all', { cart: 'cart-1', line: 'item-1' }, null],
    ['a line without a cart', { line: 'item-1' }, 'cart-1'],
    ['a cart without a line', { cart: 'cart-1' }, 'cart-1'],
    ['an empty line', { cart: 'cart-1', line: '' }, 'cart-1'],
    ['repeated ids', { cart: ['cart-1', 'cart-1'], line: 'item-1' }, 'cart-1'],
    [
      'a bare cart parameter, and no cart',
      { cart: null, line: 'item-1' },
      null,
    ],
  ])(
    'names no line, and says the link is stale, for %s',
    (_case, query, cartId) => {
      expect(editTarget(query, cartId)).toEqual({ line: null, stale: true });
    },
  );
});

describe('withoutEdit', () => {
  it('drops the cart and the line, and keeps every other parameter', () => {
    expect(withoutEdit({ cart: 'c', line: 'l', utm: 'x' })).toEqual({
      utm: 'x',
    });
    expect(withoutEdit({ utm: 'x' })).toEqual({ utm: 'x' });
  });
});

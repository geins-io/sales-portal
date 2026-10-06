import { describe, it, expect } from 'vitest';
import {
  replayLineHref,
  replayTarget,
  withoutReplay,
} from '../../app/utils/configurator-replay';

const ORDER_ID = '6f1c2a9e-0b8d-4e3f-9a51-2c7d8e4b1f03';

describe('replayLineHref', () => {
  it('puts the order and the row position on the product path, as ids only', () => {
    expect(
      replayLineHref('/se/sv/p/digging-bucket', {
        publicOrderId: ORDER_ID,
        row: 2,
      }),
    ).toBe(`/se/sv/p/digging-bucket?order=${ORDER_ID}&row=2`);
  });
});

describe('replayTarget', () => {
  it('names the order row the query points at', () => {
    expect(replayTarget({ order: ORDER_ID, row: '0' })).toEqual({
      row: { publicOrderId: ORDER_ID, row: 0 },
      stale: false,
    });
    expect(
      replayTarget({ order: ORDER_ID.toUpperCase(), row: '12' }).row,
    ).toEqual({ publicOrderId: ORDER_ID.toUpperCase(), row: 12 });
  });

  it('names nothing on an ordinary product page', () => {
    expect(replayTarget({})).toEqual({ row: null, stale: false });
    expect(replayTarget({ cart: 'cart-1', line: 'item-1' })).toEqual({
      row: null,
      stale: false,
    });
  });

  it.each([
    ['an order without a row', { order: ORDER_ID }],
    ['a row without an order', { row: '1' }],
    ['an order that is not a GUID', { order: 'order-1', row: '1' }],
    ['a GUID with something after it', { order: `${ORDER_ID}x`, row: '1' }],
    ['a GUID with something before it', { order: `x${ORDER_ID}`, row: '1' }],
    ['a negative row', { order: ORDER_ID, row: '-1' }],
    ['a fractional row', { order: ORDER_ID, row: '1.5' }],
    ['a row that is not a number', { order: ORDER_ID, row: 'one' }],
    ['an empty row', { order: ORDER_ID, row: '' }],
    ['a row with a number in it', { order: ORDER_ID, row: '1a' }],
    ['repeated ids', { order: [ORDER_ID, ORDER_ID], row: '1' }],
    ['an order id in a list', { order: [ORDER_ID], row: '1' }],
    ['a row in a list', { order: ORDER_ID, row: ['1'] }],
  ])('reads %s as a link the page cannot replay', (_case, query) => {
    expect(replayTarget(query)).toEqual({ row: null, stale: true });
  });
});

describe('withoutReplay', () => {
  it('drops the order row and keeps the rest of the query', () => {
    expect(
      withoutReplay({ order: ORDER_ID, row: '1', utm_source: 'mail' }),
    ).toEqual({ utm_source: 'mail' });
  });
});

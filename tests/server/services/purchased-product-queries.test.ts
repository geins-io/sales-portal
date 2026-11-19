import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../../../server/services/graphql');

/** What a document asks `getCompanyOrders` for, comments and spacing removed. */
function companyOrdersSelection(file: string): string {
  const text = readFileSync(join(ROOT, file), 'utf8')
    .replace(/#.*$/gm, '')
    .replace(/\s+/g, ' ');
  const root = text.indexOf('getCompanyOrders(');
  expect(root).toBeGreaterThan(-1);
  const open = text.indexOf('{', text.indexOf(')', root));
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}' && --depth === 0) {
      return text.slice(open + 1, i).trim();
    }
  }
  throw new Error(`unbalanced selection in ${file}`);
}

// Each reader asks Geins for exactly what it shows: a field here that no
// reader uses fails the test.
describe('the purchased-product documents', () => {
  it('the product page reads the order and the product id of each line', () => {
    expect(
      companyOrdersSelection('orders/latest-order-for-product.graphql'),
    ).toBe('id publicId createdAt cart { items { product { productId } } }');
  });

  it('the start page reads what its cards, count and most-bought name need', () => {
    expect(
      companyOrdersSelection('orders/purchased-products-overview.graphql'),
    ).toBe(
      'createdAt cart { items { skuId quantity unitPrice { sellingPriceExVat sellingPriceExVatFormatted sellingPriceIncVat sellingPriceIncVatFormatted } product { productId type articleNumber name } } }',
    );
  });

  it('the purchased-products list reads no sku, type or image', () => {
    expect(companyOrdersSelection('orders/purchased-products.graphql')).toBe(
      'id publicId createdAt customerEmail billingAddress { firstName lastName } cart { items { quantity unitPrice { sellingPriceExVat sellingPriceExVatFormatted sellingPriceIncVat sellingPriceIncVatFormatted } product { productId articleNumber name alias } } }',
    );
  });
});

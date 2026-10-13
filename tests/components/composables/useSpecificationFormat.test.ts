import { describe, it, expect, beforeEach, assert } from 'vitest';
import { defineComponent } from 'vue';
import { mountComponent } from '../../utils/component';
import { useSpecificationFormat } from '../../../app/composables/useSpecificationFormat';
import { useTenant } from '../../../app/composables/useTenant';
import { mockShowIncVat } from '../../setup-components';

const { tenant } = useTenant();

/** The composable's functions, from inside a component as the panels use it. */
function format(currency: string | undefined = 'SEK') {
  let found!: ReturnType<typeof useSpecificationFormat>;
  mountComponent(
    defineComponent({
      setup() {
        found = useSpecificationFormat(() => currency);
      },
      template: '<div />',
    }),
  );
  return found;
}

const plain = (text: string | null) => text?.replace(/\u00a0/g, ' ') ?? null;

describe('useSpecificationFormat', () => {
  beforeEach(() => {
    assert.isDefined(tenant.value);
    tenant.value.features = {};
    mockShowIncVat.value = false;
  });

  describe('valueText', () => {
    it('writes a number with exactly the decimals its field asks for', () => {
      const { valueText } = format();

      expect(valueText({ number: 1200.5, decimals: 2 })).toBe('1,200.50');
      expect(valueText({ number: 1200.5, decimals: 0 })).toBe('1,201');
    });

    it('writes a number with no decimals asked for as a whole number', () => {
      expect(format().valueText({ number: 1200.5 })).toBe('1,201');
    });

    it('writes the unit after the value', () => {
      expect(format().valueText({ number: 12, unit: 't' })).toBe('12 t');
      expect(format().valueText({ text: 'Hall 2', unit: 'm' })).toBe(
        'Hall 2 m',
      );
    });

    it('words a ticked box and "nothing chosen" from the locale files', () => {
      const { valueText } = format();

      expect(valueText({ boolValue: true })).toBe('configurator.yes');
      expect(valueText({ none: true })).toBe('configurator.none_option');
    });

    it('writes nothing for a value with no text', () => {
      expect(format().valueText({})).toBe('');
    });

    it('adds the quantity wherever the price is for more or less than one', () => {
      const { valueText } = format();

      expect(valueText({ text: 'J250', quantity: 4 })).toMatch(
        /^J250 · configurator\.panel\.quantity_suffix/,
      );
      expect(valueText({ text: 'Steel', quantity: 0.073 })).toMatch(
        /^Steel · configurator\.panel\.quantity_suffix/,
      );
      expect(valueText({ text: 'J250', quantity: 1 })).toBe('J250');
      expect(valueText({ text: 'J250', quantity: 0 })).toBe('J250');
      expect(valueText({ text: 'J250' })).toBe('J250');
    });
  });

  describe('valuePrice', () => {
    it('writes a price as an addition, in the currency given', () => {
      expect(
        plain(
          format('SEK').valuePrice({ price: { sellingPriceExVat: 619.49 } }),
        ),
      ).toBe('+SEK 619.49');
    });

    it('writes the price times the quantity', () => {
      expect(
        plain(
          format('SEK').valuePrice({
            quantity: 4,
            price: { sellingPriceExVat: 76.2 },
          }),
        ),
      ).toBe('+SEK 304.80');
    });

    it('writes nothing for a price of nothing, or where prices are hidden', () => {
      const { valuePrice } = format();
      expect(valuePrice({ price: { sellingPriceExVat: 0 } })).toBeNull();
      expect(
        valuePrice({ quantity: 0, price: { sellingPriceExVat: 619.49 } }),
      ).toBeNull();

      assert.isDefined(tenant.value);
      tenant.value.features = { priceVisibility: { enabled: false } };
      expect(
        format().valuePrice({ price: { sellingPriceExVat: 619.49 } }),
      ).toBeNull();
    });

    it('writes the price with VAT on the inc side, times the quantity', () => {
      mockShowIncVat.value = true;
      expect(
        plain(
          format('SEK').valuePrice({
            quantity: 4,
            price: { sellingPriceExVat: 76.2, sellingPriceIncVat: 95.25 },
          }),
        ),
      ).toBe('+SEK 381.00');
    });

    it('writes nothing on the inc side for an option that is free with VAT', () => {
      mockShowIncVat.value = true;
      expect(
        format().valuePrice({
          price: { sellingPriceExVat: 0, sellingPriceIncVat: 0 },
        }),
      ).toBeNull();
    });

    it('reads a value without a price as having none', () => {
      const { valuePrice } = format();

      expect(valuePrice({ text: 'S45' })).toBeNull();
      expect(plain(valuePrice({ price: { sellingPriceExVat: 10 } }))).toBe(
        '+SEK 10.00',
      );
    });
  });

  describe('priceLines', () => {
    const totals = { net: 9600, vat: 2400, incVat: 12000 };

    it('leads with the net on the ex side, then VAT and the total with VAT', () => {
      const { price, rows } = format('SEK').priceLines(totals);

      expect(plain(price)).toBe('SEK 9,600.00');
      expect(rows.map((row) => [row.label, plain(row.amount)])).toEqual([
        ['common.vat', 'SEK 2,400.00'],
        ['configurator.panel.total_inc_vat', 'SEK 12,000.00'],
      ]);
    });

    it('leads with the amount with VAT on the inc side, then the VAT in it', () => {
      mockShowIncVat.value = true;
      const { price, rows } = format('SEK').priceLines(totals);

      expect(plain(price)).toBe('SEK 12,000.00');
      expect(rows.map((row) => [row.label, plain(row.amount)])).toEqual([
        ['common.vat_included', 'SEK 2,400.00'],
      ]);
    });
  });
});

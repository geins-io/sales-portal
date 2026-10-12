import { describe, it, expect, beforeEach, assert } from 'vitest';
import { defineComponent } from 'vue';
import { mountComponent } from '../../utils/component';
import { useSpecificationFormat } from '../../../app/composables/useSpecificationFormat';
import { useTenant } from '../../../app/composables/useTenant';

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

    it('reads a value without a price as having none', () => {
      const { valuePrice } = format();

      expect(valuePrice({ text: 'S45' })).toBeNull();
      expect(plain(valuePrice({ price: { sellingPriceExVat: 10 } }))).toBe(
        '+SEK 10.00',
      );
    });
  });
});

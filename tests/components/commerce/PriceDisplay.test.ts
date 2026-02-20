import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import PriceDisplay from '../../../app/components/shared/PriceDisplay.vue';

function makePrice(overrides: Record<string, unknown> = {}) {
  return {
    sellingPriceIncVat: 199,
    sellingPriceExVat: 159.2,
    regularPriceIncVat: 299,
    regularPriceExVat: 239.2,
    sellingPriceIncVatFormatted: '199,00 kr',
    sellingPriceExVatFormatted: '159,20 kr',
    regularPriceIncVatFormatted: '299,00 kr',
    regularPriceExVatFormatted: '239,20 kr',
    discountPercentage: 33,
    isDiscounted: true,
    currency: { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
    ...overrides,
  };
}

describe('PriceDisplay', () => {
  it('renders selling price inc VAT by default', () => {
    const wrapper = mountComponent(PriceDisplay, {
      props: { price: makePrice() },
    });
    expect(wrapper.text()).toContain('199,00 kr');
  });

  it('renders selling price ex VAT when showVat is false', () => {
    const wrapper = mountComponent(PriceDisplay, {
      props: { price: makePrice(), showVat: false },
    });
    expect(wrapper.text()).toContain('159,20 kr');
  });

  it('shows crossed-out regular price when discounted', () => {
    const wrapper = mountComponent(PriceDisplay, {
      props: { price: makePrice() },
    });
    const lineThrough = wrapper.find('.line-through');
    expect(lineThrough.exists()).toBe(true);
    expect(lineThrough.text()).toContain('299,00 kr');
  });

  it('does not show regular price when not discounted', () => {
    const wrapper = mountComponent(PriceDisplay, {
      props: { price: makePrice({ isDiscounted: false }) },
    });
    expect(wrapper.find('.line-through').exists()).toBe(false);
  });

  it('hides discount when showDiscount is false', () => {
    const wrapper = mountComponent(PriceDisplay, {
      props: { price: makePrice(), showDiscount: false },
    });
    expect(wrapper.find('.line-through').exists()).toBe(false);
  });

  it('shows discount percentage badge when discounted', () => {
    const wrapper = mountComponent(PriceDisplay, {
      props: { price: makePrice() },
    });
    expect(wrapper.text()).toContain('-33%');
  });

  it('shows "From" prefix when fromPrice is true', () => {
    const wrapper = mountComponent(PriceDisplay, {
      props: { price: makePrice(), fromPrice: true },
    });
    expect(wrapper.text()).toContain('From');
  });

  it('falls back to Intl.NumberFormat when formatted strings are missing', () => {
    const price = makePrice({
      sellingPriceIncVatFormatted: undefined,
      sellingPriceExVatFormatted: undefined,
      regularPriceIncVatFormatted: undefined,
      regularPriceExVatFormatted: undefined,
    });
    const wrapper = mountComponent(PriceDisplay, {
      props: { price },
    });
    expect(wrapper.text()).toMatch(/\d/);
  });

  it('renders nothing when price is undefined', () => {
    const wrapper = mountComponent(PriceDisplay, {
      props: { price: undefined },
    });
    expect(wrapper.text()).toBe('');
  });
});

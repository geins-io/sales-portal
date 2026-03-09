import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountComponent } from '../../utils/component';
import PriceDisplay from '../../../app/components/shared/PriceDisplay.vue';
import { useTenant } from '../../../app/composables/useTenant';

// useTenant mock is provided by setup-components.ts — access tenant ref to control features
const { tenant } = useTenant();

const mockCanAccess = vi.fn(() => true);

vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canAccess: mockCanAccess }),
}));

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
  beforeEach(() => {
    tenant.value.features = {};
    mockCanAccess.mockReturnValue(true);
  });

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

  describe('lowest price (EU compliance)', () => {
    function makeLowestPrice(overrides: Record<string, unknown> = {}) {
      return {
        lowestPriceIncVat: 149,
        lowestPriceIncVatFormatted: '149,00 kr',
        lowestPriceExVat: 119.2,
        lowestPriceExVatFormatted: '119,20 kr',
        comparisonPriceIncVat: 299,
        comparisonPriceIncVatFormatted: '299,00 kr',
        comparisonPriceExVat: 239.2,
        comparisonPriceExVatFormatted: '239,20 kr',
        isDiscounted: true,
        discountPercentage: 50,
        ...overrides,
      };
    }

    it('shows lowest price when lowestPrice is provided and discounted', () => {
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice(), lowestPrice: makeLowestPrice() },
      });
      const lowestEl = wrapper.find('[data-testid="lowest-price"]');
      expect(lowestEl.exists()).toBe(true);
      expect(lowestEl.text()).toContain('product.lowest_price_30d');
    });

    it('hides lowest price when lowestPrice is not discounted', () => {
      const wrapper = mountComponent(PriceDisplay, {
        props: {
          price: makePrice(),
          lowestPrice: makeLowestPrice({ isDiscounted: false }),
        },
      });
      expect(wrapper.find('[data-testid="lowest-price"]').exists()).toBe(false);
    });

    it('hides lowest price when lowestPrice is not provided', () => {
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice() },
      });
      expect(wrapper.find('[data-testid="lowest-price"]').exists()).toBe(false);
    });
  });

  describe('discount type label', () => {
    it('shows "Sale" label for SALE_PRICE when discounted', () => {
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice(), discountType: 'SALE_PRICE' },
      });
      const label = wrapper.find('[data-testid="discount-type-label"]');
      expect(label.exists()).toBe(true);
      expect(label.text()).toBe('discount.sale');
    });

    it('shows campaign name for PRICE_CAMPAIGN when discounted', () => {
      const wrapper = mountComponent(PriceDisplay, {
        props: {
          price: makePrice(),
          discountType: 'PRICE_CAMPAIGN',
          campaignNames: ['Summer Sale'],
        },
      });
      const label = wrapper.find('[data-testid="discount-type-label"]');
      expect(label.exists()).toBe(true);
      expect(label.text()).toBe('Summer Sale');
    });

    it('falls back to generic campaign label when no campaign names', () => {
      const wrapper = mountComponent(PriceDisplay, {
        props: {
          price: makePrice(),
          discountType: 'PRICE_CAMPAIGN',
        },
      });
      const label = wrapper.find('[data-testid="discount-type-label"]');
      expect(label.exists()).toBe(true);
      expect(label.text()).toBe('discount.campaign');
    });

    it('shows "Your price" for EXTERNAL in blue styling', () => {
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice(), discountType: 'EXTERNAL' },
      });
      const label = wrapper.find('[data-testid="discount-type-label"]');
      expect(label.exists()).toBe(true);
      expect(label.text()).toBe('discount.your_price');
      expect(label.classes()).toContain('text-blue-800');
    });

    it('shows no label for NONE', () => {
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice(), discountType: 'NONE' },
      });
      expect(wrapper.find('[data-testid="discount-type-label"]').exists()).toBe(
        false,
      );
    });

    it('shows no label when not discounted', () => {
      const wrapper = mountComponent(PriceDisplay, {
        props: {
          price: makePrice({ isDiscounted: false }),
          discountType: 'SALE_PRICE',
        },
      });
      expect(wrapper.find('[data-testid="discount-type-label"]').exists()).toBe(
        false,
      );
    });

    it('shows no label when discountType is not provided', () => {
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice() },
      });
      expect(wrapper.find('[data-testid="discount-type-label"]').exists()).toBe(
        false,
      );
    });

    it('uses destructive styling for SALE_PRICE', () => {
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice(), discountType: 'SALE_PRICE' },
      });
      const label = wrapper.find('[data-testid="discount-type-label"]');
      expect(label.classes()).toContain('text-destructive');
    });
  });

  describe('feature flags', () => {
    it('shows price when pricing feature is not configured', () => {
      tenant.value.features = {};
      mockCanAccess.mockReturnValue(false);
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice() },
      });
      expect(wrapper.text()).toContain('199,00 kr');
    });

    it('shows price when pricing feature allows access', () => {
      tenant.value.features = { pricing: { enabled: true } };
      mockCanAccess.mockReturnValue(true);
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice() },
      });
      expect(wrapper.text()).toContain('199,00 kr');
    });

    it('shows login message when pricing feature denies access', () => {
      tenant.value.features = { pricing: { enabled: true } };
      mockCanAccess.mockReturnValue(false);
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice() },
      });
      expect(wrapper.text()).toContain('product.login_for_prices');
      expect(wrapper.text()).not.toContain('199,00 kr');
    });
  });
});

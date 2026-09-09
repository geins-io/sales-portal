import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import type { AuthUser } from '@geins/types';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { mountComponent } from '../../utils/component';
import PriceDisplay from '../../../app/components/shared/PriceDisplay.vue';
import { useTenant } from '../../../app/composables/useTenant';
import { useAuthStore } from '../../../app/stores/auth';
// useVatDisplay is mocked in setup-components.ts; drive it via this shared ref.
import { mockShowIncVat } from '../../setup-components';

// useTenant mock is provided by setup-components.ts — access tenant ref to control features
const { tenant } = useTenant();

// `useTenant()` types `tenant` as nullable because the real composable fills it
// from useFetch. The setup-components mock always provides one, so assert it
// here once instead of reaching for `!` at each site.
function setFeatures(features: PublicTenantConfig['features']) {
  assert.isDefined(tenant.value);
  tenant.value.features = features;
}

// Escapes the tier-wide mock, which answers true for every key; see
// tests/setup-components.ts. The real chain then runs over the fixture below.
vi.unmock('../../../app/composables/useFeatureAccess');

// `isAuthenticated` is `!!user.value`, so identity is all this needs to carry.
const SIGNED_IN: AuthUser = {
  userId: '1',
  username: 'buyer@example.com',
};

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
    setFeatures({});
    // Sign out: the Pinia store is shared across this file's tests.
    useAuthStore().user = null;
    mockShowIncVat.value = true;
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

  describe('VAT preference resolution', () => {
    it('follows the preference (inc) when showVat is omitted', () => {
      mockShowIncVat.value = true;
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice() },
      });
      expect(wrapper.text()).toContain('199,00 kr');
      expect(wrapper.text()).not.toContain('common.vat_excl');
    });

    it('follows the preference (ex) when showVat is omitted', () => {
      mockShowIncVat.value = false;
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice() },
      });
      expect(wrapper.text()).toContain('159,20 kr');
      expect(wrapper.text()).toContain('common.vat_excl');
    });

    it('honors explicit show-vat=true even when the preference is ex', () => {
      mockShowIncVat.value = false;
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice(), showVat: true },
      });
      expect(wrapper.text()).toContain('199,00 kr');
      expect(wrapper.text()).not.toContain('common.vat_excl');
    });

    it('honors explicit show-vat=false even when the preference is inc', () => {
      mockShowIncVat.value = true;
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice(), showVat: false },
      });
      expect(wrapper.text()).toContain('159,20 kr');
      expect(wrapper.text()).toContain('common.vat_excl');
    });
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

  // One test per configured value of `priceVisibility`, each writing the value
  // itself rather than a decision derived from it. Registered in
  // tests/unit/config-coverage/map.ts, which requires the key in the title.
  describe('priceVisibility', () => {
    function mount() {
      return mountComponent(PriceDisplay, { props: { price: makePrice() } });
    }

    it('shows the price when priceVisibility is absent from features', () => {
      setFeatures({});
      expect(mount().text()).toContain('199,00 kr');
    });

    it('shows the price when priceVisibility is enabled with no access rule', () => {
      setFeatures({ priceVisibility: { enabled: true } });
      expect(mount().text()).toContain('199,00 kr');
    });

    it('renders nothing when priceVisibility is disabled', () => {
      setFeatures({ priceVisibility: { enabled: false } });
      expect(mount().text()).toBe('');
    });

    it('shows the price when priceVisibility access is open to all', () => {
      setFeatures({ priceVisibility: { enabled: true, access: 'all' } });
      expect(mount().text()).toContain('199,00 kr');
    });

    it('renders nothing when priceVisibility requires authentication and the user is anonymous', () => {
      setFeatures({
        priceVisibility: { enabled: true, access: 'authenticated' },
      });
      expect(mount().text()).toBe('');
    });

    it('shows the price when priceVisibility requires authentication and the user is signed in', () => {
      setFeatures({
        priceVisibility: { enabled: true, access: 'authenticated' },
      });
      useAuthStore().user = SIGNED_IN;
      expect(mount().text()).toContain('199,00 kr');
    });
  });
});

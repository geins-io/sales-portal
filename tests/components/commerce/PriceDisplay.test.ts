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

  describe('testid prop', () => {
    it('puts the given test id on the element carrying the amount', () => {
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice(), testid: 'pdp-price' },
      });
      const el = wrapper.find('[data-testid="pdp-price"]');
      expect(el.exists()).toBe(true);
      expect(el.text()).toContain('199,00 kr');
    });

    it('renders no data-testid at all when the prop is omitted', () => {
      // The six call sites that pass nothing must not gain an id, or a shared
      // component puts the same one on every surface at once.
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice() },
      });
      const amount = wrapper.find('.font-semibold');
      expect(amount.text()).toContain('199,00 kr');
      expect(amount.attributes('data-testid')).toBeUndefined();
    });
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

    it('leaves the VAT word to the caller when asked to', () => {
      mockShowIncVat.value = false;
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice(), vatLabel: false },
      });
      expect(wrapper.text()).toContain('159,20 kr');
      expect(wrapper.text()).not.toContain('common.vat_excl');
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

  describe('a flag raised by rounding alone', () => {
    // Measured on a CPQ-enabled account: the regular price with more decimals,
    // the selling price inc VAT one öre lower, the flag up, no campaign.
    const roundingOnly = () =>
      makePrice({
        regularPriceExVat: 86.74170868,
        sellingPriceExVat: 86.74,
        regularPriceIncVat: 108.43,
        sellingPriceIncVat: 108.42,
        regularPriceExVatFormatted: '86,74 kr',
        sellingPriceExVatFormatted: '86,74 kr',
        regularPriceIncVatFormatted: '108,43 kr',
        sellingPriceIncVatFormatted: '108,42 kr',
        discountPercentage: 0,
      });

    it.each([
      ['inc', true],
      ['ex', false],
    ])('renders an ordinary price %s VAT', (_mode, showVat) => {
      const wrapper = mountComponent(PriceDisplay, {
        props: {
          price: roundingOnly(),
          showVat,
          discountType: 'SALE_PRICE',
          testid: 'amount',
        },
      });
      expect(wrapper.find('.line-through').exists()).toBe(false);
      expect(wrapper.find('[data-testid="amount"]').classes()).not.toContain(
        'text-danger',
      );
      expect(wrapper.find('[data-testid="discount-type-label"]').exists()).toBe(
        false,
      );
    });

    it('still shows a real discount in red with the regular price struck', () => {
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice(), testid: 'amount' },
      });
      expect(wrapper.find('[data-testid="amount"]').classes()).toContain(
        'text-danger',
      );
      expect(wrapper.find('.line-through').text()).toContain('299,00 kr');
    });
  });

  describe('a line total, with the threshold widened by its quantity', () => {
    // The measured unit price times 3: the regular price's extra decimals make
    // the total's gap 0.00513, over one unit's threshold, under three units'.
    const roundingTotal = () =>
      makePrice({
        regularPriceExVat: 260.22512604,
        sellingPriceExVat: 260.22,
        regularPriceExVatFormatted: '260,23 kr',
        sellingPriceExVatFormatted: '260,22 kr',
        discountPercentage: 0,
      });
    const mountTotal = (
      price: ReturnType<typeof makePrice>,
      quantity?: number,
    ) =>
      mountComponent(PriceDisplay, {
        props: { price, quantity, showVat: false, testid: 'amount' },
      });

    it('renders an ordinary total when the gap is rounding on 3 units', () => {
      const wrapper = mountTotal(roundingTotal(), 3);
      expect(wrapper.find('.line-through').exists()).toBe(false);
      expect(wrapper.find('[data-testid="amount"]').classes()).not.toContain(
        'text-danger',
      );
    });

    it('shows a discount the total carries on its own', () => {
      // A quantity campaign: the total discounted, the unit price not.
      const wrapper = mountTotal(
        makePrice({
          regularPriceExVat: 260.22,
          sellingPriceExVat: 240,
          regularPriceExVatFormatted: '260,22 kr',
          sellingPriceExVatFormatted: '240,00 kr',
        }),
        3,
      );
      expect(wrapper.find('[data-testid="amount"]').classes()).toContain(
        'text-danger',
      );
      expect(wrapper.find('.line-through').text()).toContain('260,22 kr');
    });

    it('judges one unit without a quantity, as before', () => {
      const wrapper = mountTotal(roundingTotal());
      expect(wrapper.find('[data-testid="amount"]').classes()).toContain(
        'text-danger',
      );
    });
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

    it('shows "Your price" for EXTERNAL as an info badge', () => {
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice(), discountType: 'EXTERNAL' },
      });
      const label = wrapper.find('[data-testid="discount-type-label"]');
      expect(label.exists()).toBe(true);
      expect(label.text()).toBe('discount.your_price');
      expect(label.attributes('data-slot')).toBe('badge');
      expect(label.classes()).toEqual(
        expect.arrayContaining(['bg-info/10', 'text-info']),
      );
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

    it('uses the danger badge for SALE_PRICE', () => {
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice(), discountType: 'SALE_PRICE' },
      });
      const label = wrapper.find('[data-testid="discount-type-label"]');
      expect(label.attributes('data-slot')).toBe('badge');
      expect(label.classes()).toEqual(
        expect.arrayContaining(['bg-danger/10', 'text-danger']),
      );
    });
  });

  // The product page's price. Every case here is proven on mocked prices:
  // EXTERNAL has never been seen in data.
  describe('variant detail', () => {
    const LOWEST = {
      lowestPriceIncVat: 149,
      lowestPriceIncVatFormatted: '149,00 kr',
      lowestPriceExVat: 119.2,
      lowestPriceExVatFormatted: '119,20 kr',
      comparisonPriceIncVat: 299,
      comparisonPriceExVat: 239.2,
      isDiscounted: true,
      discountPercentage: 50,
    };

    function mount(props: Record<string, unknown>, variant?: 'detail') {
      return mountComponent(PriceDisplay, {
        props: {
          price: makePrice(),
          lowestPrice: LOWEST,
          testid: 'amount',
          ...(variant ? { variant } : {}),
          ...props,
        },
      });
    }
    const LABEL = '[data-testid="discount-type-label"]';
    const AMOUNT = '[data-testid="amount"]';

    /** What a viewer reads, in document order: label, price, strike, percent, lowest. */
    function reading(wrapper: ReturnType<typeof mount>) {
      const label = wrapper.find(LABEL);
      const amount = wrapper.get(AMOUNT);
      return {
        label: label.exists() ? label.text() : null,
        labelAbove: label.exists()
          ? Boolean(
              label.element.compareDocumentPosition(amount.element) &
              Node.DOCUMENT_POSITION_FOLLOWING,
            ) && !label.element.parentElement?.contains(amount.element)
          : null,
        red: amount.classes().includes('text-danger'),
        struck: wrapper.find('.line-through').exists()
          ? wrapper.get('.line-through').text()
          : null,
        percent: wrapper.text().includes('-33%'),
        lowest: wrapper.find('[data-testid="lowest-price"]').exists(),
      };
    }

    describe('a negotiated (EXTERNAL) price', () => {
      it('below the regular price: "Your price" above it, not a sale', () => {
        expect(reading(mount({ discountType: 'EXTERNAL' }, 'detail'))).toEqual({
          label: 'discount.your_price',
          labelAbove: true,
          red: false,
          struck: '299,00 kr',
          percent: false,
          lowest: false,
        });
      });

      it('keeps the info badge for the label', () => {
        const label = mount({ discountType: 'EXTERNAL' }, 'detail').get(LABEL);
        expect(label.classes()).toEqual(
          expect.arrayContaining(['bg-info/10', 'text-info']),
        );
      });

      it('equal to the regular price: no label and nothing struck', () => {
        const wrapper = mount(
          {
            discountType: 'EXTERNAL',
            price: makePrice({
              sellingPriceExVat: 239.2,
              sellingPriceIncVat: 299,
              sellingPriceIncVatFormatted: '299,00 kr',
              discountPercentage: 0,
            }),
          },
          'detail',
        );
        expect(reading(wrapper)).toMatchObject({
          label: null,
          red: false,
          struck: null,
        });
      });

      it('not discounted: no label and nothing struck', () => {
        const wrapper = mount(
          {
            discountType: 'EXTERNAL',
            price: makePrice({ isDiscounted: false }),
            lowestPrice: { ...LOWEST, isDiscounted: false },
          },
          'detail',
        );
        expect(reading(wrapper)).toEqual({
          label: null,
          labelAbove: null,
          red: false,
          struck: null,
          percent: false,
          lowest: false,
        });
      });

      it('without the variant: as today, a red price with the label beside it', () => {
        expect(reading(mount({ discountType: 'EXTERNAL' }))).toEqual({
          label: 'discount.your_price',
          labelAbove: false,
          red: true,
          struck: '299,00 kr',
          percent: true,
          lowest: true,
        });
      });
    });

    it('renders a PRICE_LIST price as without the variant', () => {
      const props = { discountType: 'PRICE_LIST' };
      const detail = mount(props, 'detail');
      expect(reading(detail)).toEqual(reading(mount(props)));
      expect(reading(detail)).toMatchObject({
        red: true,
        percent: true,
        lowest: true,
      });
    });

    it('shows no label for PRICE_CAMPAIGN when a campaign name is given', () => {
      const wrapper = mount(
        {
          discountType: 'PRICE_CAMPAIGN',
          campaignNames: ['Summer Sale', 'Autumn'],
        },
        'detail',
      );
      expect(wrapper.find(LABEL).exists()).toBe(false);
      expect(wrapper.text()).not.toContain('Summer Sale');
    });

    it('keeps the generic campaign label when no campaign name is given', () => {
      const wrapper = mount(
        { discountType: 'PRICE_CAMPAIGN', campaignNames: [] },
        'detail',
      );
      expect(wrapper.find(LABEL).text()).toBe('discount.campaign');
    });

    it('keeps the red price, percent and lowest price for PRICE_CAMPAIGN', () => {
      const wrapper = mount(
        { discountType: 'PRICE_CAMPAIGN', campaignNames: ['Summer Sale'] },
        'detail',
      );
      expect(reading(wrapper)).toMatchObject({
        red: true,
        percent: true,
        lowest: true,
      });
    });

    it('keeps the SALE_PRICE label beside a red price', () => {
      const wrapper = mount({ discountType: 'SALE_PRICE' }, 'detail');
      expect(reading(wrapper)).toEqual(
        reading(mount({ discountType: 'SALE_PRICE' })),
      );
      expect(reading(wrapper)).toMatchObject({
        label: 'discount.sale',
        labelAbove: false,
        red: true,
      });
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

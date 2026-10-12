import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';
import { shallowMountComponent } from '../../utils/component';
import CartPage from '../../../app/components/pages/CartPage.vue';
import type { CartType } from '../../../shared/types/commerce';
import { useCartStore } from '../../../app/stores/cart';
import { createPinia, setActivePinia } from 'pinia';
import { mockShowIncVat } from '../../setup-components';

const mockShowPrice = ref(true);
vi.mock('../../../app/composables/usePriceVisibility', () => ({
  usePriceVisibility: () => ({ showPrice: mockShowPrice }),
}));

const mockCart: CartType = {
  id: 'cart-123',
  items: [
    {
      id: 'item-1',
      skuId: 100,
      quantity: 2,
      product: {
        productId: '1',
        name: 'Test Product',
        alias: 'test-product',
        articleNumber: '4451',
        brand: { name: 'TestBrand' },
        productImages: [{ fileName: 'test.jpg' }],
        canonicalUrl: '/test-product',
        primaryCategory: { name: 'Category' },
        skus: [],
        unitPrice: {
          sellingPriceIncVat: 89.99,
          sellingPriceIncVatFormatted: '$89.99',
        },
      },
      unitPrice: {
        sellingPriceIncVat: 89.99,
        sellingPriceIncVatFormatted: '$89.99',
      },
      totalPrice: {
        sellingPriceIncVat: 179.98,
        sellingPriceIncVatFormatted: '$179.98',
      },
    },
    {
      id: 'item-2',
      skuId: 200,
      quantity: 1,
      product: {
        productId: '2',
        name: 'Another Product',
        alias: 'another-product',
        articleNumber: '4452',
        brand: { name: 'TestBrand' },
        productImages: [],
        canonicalUrl: '/another-product',
        primaryCategory: { name: 'Category' },
        skus: [],
        unitPrice: {
          sellingPriceIncVat: 49.99,
          sellingPriceIncVatFormatted: '$49.99',
        },
      },
      unitPrice: {
        sellingPriceIncVat: 49.99,
        sellingPriceIncVatFormatted: '$49.99',
      },
      totalPrice: {
        sellingPriceIncVat: 49.99,
        sellingPriceIncVatFormatted: '$49.99',
      },
    },
  ],
  freeShipping: false,
  completed: false,
  fixedDiscount: 0,
  appliedCampaigns: [],
  summary: {
    total: {
      sellingPriceIncVat: 237.97,
      sellingPriceIncVatFormatted: '$237.97',
      sellingPriceExVat: 190.38,
      sellingPriceExVatFormatted: '$190.38',
    },
    subTotal: {
      sellingPriceIncVat: 229.97,
      sellingPriceIncVatFormatted: '$229.97',
      sellingPriceExVat: 183.97,
      sellingPriceExVatFormatted: '$183.97',
    },
    vats: [{ rate: 0.08, amount: 17.23 }],
    fees: {
      paymentFeeIncVat: 0,
      paymentFeeExVat: 0,
      shippingFeeIncVat: 8.0,
      shippingFeeExVat: 7.41,
    },
    balance: {
      pending: 0,
      pendingFormatted: '$0.00',
      totalSellingPriceExBalanceExVat: 220.34,
      totalSellingPriceExBalanceIncVat: 237.97,
      totalSellingPriceExBalanceIncVatFormatted: '$237.97',
    },
    shipping: {
      id: 1,
      feeIncVat: 8.0,
      feeExVat: 7.41,
      isDefault: true,
      isSelected: false,
      amountLeftToFreeShipping: 0,
      feeIncVatFormatted: '$8.00',
    },
    payment: {
      id: 1,
      feeIncVat: 0,
      feeExVat: 0,
      isDefault: true,
      isSelected: false,
    },
  },
} as unknown as CartType;

const buttonStub = {
  template:
    '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
  props: ['disabled', 'variant', 'size'],
  emits: ['click'],
};

const defaultStubs = {
  Button: buttonStub,
  UiButton: buttonStub,
  CartItem: {
    template: '<div data-testid="cart-item" />',
    props: ['item'],
  },
  ErrorBoundary: {
    template: '<div><slot /></div>',
    props: ['section'],
  },
  SharedErrorBoundary: {
    template: '<div><slot /></div>',
    props: ['section'],
  },
  CartSkippedNote: { template: '<p data-testid="skipped-note" />' },
  GeinsImage: true,
  PriceDisplay: true,
  QuantityInput: true,
  CartPageSkeleton: {
    template: '<div data-testid="cart-page-loading" />',
  },
  PagesCartPageSkeleton: {
    template: '<div data-testid="cart-page-loading" />',
  },
};

describe('CartPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(useRouter().push).mockClear();
    mockShowIncVat.value = true;
  });

  it('renders the page with data-testid', () => {
    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });
    expect(wrapper.find('[data-testid="cart-page"]').exists()).toBe(true);
  });

  it('renders empty state when cart is empty', () => {
    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });
    expect(wrapper.find('[data-testid="cart-page-empty"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cart-order-summary"]').exists()).toBe(
      false,
    );
  });

  it('asks the buyer to sign in, in place of the empty state, when the cart needs it', () => {
    useCartStore().needsSignIn = true;

    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });

    expect(wrapper.find('[data-testid="cart-page-sign-in"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="cart-page-empty"]').exists()).toBe(
      false,
    );
  });

  it('renders the page title with item count', () => {
    const store = useCartStore();
    store.cart = mockCart;

    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });

    const title = wrapper.find('[data-testid="cart-page-title"]');
    expect(title.exists()).toBe(true);
    expect(title.text()).toContain('cart.shopping_cart');
    expect(title.text()).toContain('cart.item_count');
  });

  it('renders cart items when cart has items', () => {
    const store = useCartStore();
    store.cart = mockCart;

    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });

    expect(wrapper.find('[data-testid="cart-page-empty"]').exists()).toBe(
      false,
    );
    expect(wrapper.findAll('[data-testid="cart-item"]').length).toBe(2);
  });

  it('puts the skip note above the cart lines', () => {
    const store = useCartStore();
    store.cart = mockCart;

    const html = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    }).html();

    expect(html).toContain('data-testid="skipped-note"');
    expect(html.indexOf('data-testid="skipped-note"')).toBeLessThan(
      html.indexOf('data-testid="cart-item"'),
    );
  });

  it('puts the skip note above the empty state, for a bulk add that added nothing', () => {
    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });
    const html = wrapper.html();

    expect(wrapper.find('[data-testid="cart-page-empty"]').exists()).toBe(true);
    expect(html.indexOf('data-testid="skipped-note"')).toBeGreaterThan(-1);
    expect(html.indexOf('data-testid="skipped-note"')).toBeLessThan(
      html.indexOf('data-testid="cart-page-empty"'),
    );
  });

  it('hands a configured line its configuration, next to an ordinary line', () => {
    const store = useCartStore();
    const [ordinary] = mockCart.items;
    store.cart = {
      ...mockCart,
      items: [
        {
          ...ordinary!,
          id: 'item-1',
          configuration: {
            configurationId: 'committed-1',
            summary: [{ label: 'Adapter', value: 'S45' }],
          },
        },
        { ...ordinary!, id: 'item-2' },
      ],
    };

    const wrapper = shallowMountComponent(CartPage, {
      global: {
        stubs: {
          ...defaultStubs,
          CartItem: {
            template:
              '<div data-testid="cart-item">{{ item.configuration?.summary[0]?.value ?? "-" }}</div>',
            props: ['item'],
          },
        },
      },
    });

    expect(
      wrapper.findAll('[data-testid="cart-item"]').map((item) => item.text()),
    ).toEqual(['S45', '-']);
  });

  it('renders order summary with subtotal and total', () => {
    const store = useCartStore();
    store.cart = mockCart;

    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });

    const summary = wrapper.find('[data-testid="cart-order-summary"]');
    expect(summary.exists()).toBe(true);

    const subtotal = wrapper.find('[data-testid="cart-summary-subtotal"]');
    expect(subtotal.text()).toBe('$229.97');

    const total = wrapper.find('[data-testid="cart-summary-total"]');
    expect(total.text()).toBe('$237.97');
  });

  it('renders shipping fee in summary', () => {
    const store = useCartStore();
    store.cart = mockCart;

    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });

    const shipping = wrapper.find('[data-testid="cart-summary-shipping"]');
    expect(shipping.text()).toBe('$8.00');
  });

  it('leaves out shipping when the cart has no fee, as the panel does', () => {
    const store = useCartStore();
    store.cart = {
      ...mockCart,
      summary: {
        ...mockCart.summary,
        shipping: { ...mockCart.summary.shipping, feeIncVatFormatted: '' },
      },
    } as unknown as CartType;

    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });

    expect(wrapper.find('[data-testid="cart-summary-shipping"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).not.toContain('cart.calculated_at_checkout');
  });

  it('leaves out VAT when the cart has none, as the panel does', () => {
    const store = useCartStore();
    store.cart = {
      ...mockCart,
      summary: {
        ...mockCart.summary,
        total: { ...mockCart.summary.total, vatFormatted: '' },
      },
    } as unknown as CartType;

    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });

    expect(wrapper.find('[data-testid="cart-summary-tax"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).not.toContain('cart.calculated_at_checkout');
  });

  it('checkout button is not disabled when cart has items', () => {
    const store = useCartStore();
    store.cart = mockCart;

    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });

    const btn = wrapper.find('[data-testid="cart-checkout-button"]');
    expect(btn.exists()).toBe(true);
    expect(btn.attributes('disabled')).toBeUndefined();
    expect(btn.text()).toContain('cart.proceed_to_checkout');
  });

  it('checkout button navigates to /checkout on click', async () => {
    const store = useCartStore();
    store.cart = mockCart;
    const router = useRouter();

    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });

    await wrapper.find('[data-testid="cart-checkout-button"]').trigger('click');
    expect(router.push).toHaveBeenCalledWith('/se/en/checkout');
  });

  it('checkout button is disabled while a configured line is changing', () => {
    const store = useCartStore();
    store.cart = mockCart;
    store.updatingItems.add('item-1');

    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });

    const btn = wrapper.find('[data-testid="cart-checkout-button"]');
    expect(btn.attributes('disabled')).toBeDefined();
  });

  it('checkout button is disabled during loading', () => {
    const store = useCartStore();
    store.cart = mockCart;
    store.isLoading = true;

    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });

    const btn = wrapper.find('[data-testid="cart-checkout-button"]');
    expect(btn.attributes('disabled')).toBeDefined();
  });

  it('renders close button', () => {
    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });

    expect(wrapper.find('[data-testid="cart-page-close"]').exists()).toBe(true);
  });

  describe('closing the page', () => {
    afterEach(() => {
      window.history.replaceState(null, '');
    });

    async function close() {
      const router = useRouter();
      vi.mocked(router.back).mockClear();
      vi.mocked(router.push).mockClear();
      const wrapper = shallowMountComponent(CartPage, {
        global: { stubs: defaultStubs },
      });
      await wrapper.find('[data-testid="cart-page-close"]').trigger('click');
      return router;
    }

    it('goes back to the page the buyer came from inside the portal', async () => {
      window.history.replaceState({ back: '/se/en/p/test-product' }, '');

      const router = await close();

      expect(router.back).toHaveBeenCalledOnce();
      expect(router.push).not.toHaveBeenCalled();
    });

    it('goes to the start page when the cart was opened directly', async () => {
      window.history.replaceState({ back: null }, '');

      const router = await close();

      expect(router.back).not.toHaveBeenCalled();
      expect(router.push).toHaveBeenCalledWith(
        expect.stringMatching(/^\/se\/en\/?$/),
      );
    });
  });

  it('renders error message when store has error', () => {
    const store = useCartStore();
    store.cart = mockCart;
    store.error = 'Something went wrong';

    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });

    const error = wrapper.find('[data-testid="cart-page-error"]');
    expect(error.exists()).toBe(true);
    expect(error.text()).toBe('Something went wrong');
  });

  it('does not render error message when no error', () => {
    const store = useCartStore();
    store.cart = mockCart;

    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });

    expect(wrapper.find('[data-testid="cart-page-error"]').exists()).toBe(
      false,
    );
  });

  it('shows loading state when loading with no cart', () => {
    const store = useCartStore();
    store.isLoading = true;
    store.cart = null;

    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });

    expect(wrapper.find('[data-testid="cart-page-loading"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="cart-page-empty"]').exists()).toBe(
      false,
    );
  });

  describe('VAT preference on subtotal and total', () => {
    it('shows incl-VAT subtotal and total when showIncVat is true', () => {
      mockShowIncVat.value = true;
      const store = useCartStore();
      store.cart = mockCart;

      const wrapper = shallowMountComponent(CartPage, {
        global: { stubs: defaultStubs },
      });

      const subtotal = wrapper.find('[data-testid="cart-summary-subtotal"]');
      expect(subtotal.text()).toBe('$229.97');

      const total = wrapper.find('[data-testid="cart-summary-total"]');
      expect(total.text()).toBe('$237.97');
    });

    it('shows excl-VAT subtotal and total when showIncVat is false', () => {
      mockShowIncVat.value = false;
      const store = useCartStore();
      store.cart = mockCart;

      const wrapper = shallowMountComponent(CartPage, {
        global: { stubs: defaultStubs },
      });

      const subtotal = wrapper.find('[data-testid="cart-summary-subtotal"]');
      expect(subtotal.text()).toBe('$183.97');

      const total = wrapper.find('[data-testid="cart-summary-total"]');
      expect(total.text()).toBe('$190.38');
    });
  });

  describe('discount line', () => {
    function makeCartWithDiscount(discount: number) {
      return {
        ...mockCart,
        fixedDiscount: discount,
        appliedCampaigns:
          discount > 0 ? [{ name: 'Cart discount', hideTitle: false }] : [],
        summary: {
          ...mockCart.summary,
          fixedAmountDiscountIncVat: discount,
          fixedAmountDiscountExVat: discount * 0.8,
        },
      } as unknown as CartType;
    }

    it('shows discount line when fixedAmountDiscountIncVat > 0', () => {
      const store = useCartStore();
      store.cart = makeCartWithDiscount(50);

      const wrapper = shallowMountComponent(CartPage, {
        global: { stubs: defaultStubs },
      });

      expect(
        wrapper.find('[data-testid="cart-summary-discount"]').exists(),
      ).toBe(true);
    });

    it('hides discount line when fixedAmountDiscountIncVat is 0', () => {
      const store = useCartStore();
      store.cart = makeCartWithDiscount(0);

      const wrapper = shallowMountComponent(CartPage, {
        global: { stubs: defaultStubs },
      });

      expect(
        wrapper.find('[data-testid="cart-summary-discount"]').exists(),
      ).toBe(false);
    });

    it('shows cart-level campaign names', () => {
      const store = useCartStore();
      store.cart = makeCartWithDiscount(50);

      const wrapper = shallowMountComponent(CartPage, {
        global: { stubs: defaultStubs },
      });

      const campaigns = wrapper.find('[data-testid="cart-campaigns"]');
      expect(campaigns.exists()).toBe(true);
      expect(campaigns.text()).toContain('Cart discount');
    });
  });

  describe('made the same way as the panel', () => {
    function mountPage(cart: CartType | null = mockCart) {
      useCartStore().cart = cart;
      return shallowMountComponent(CartPage, {
        global: { stubs: defaultStubs },
      });
    }
    const byId = (wrapper: ReturnType<typeof mountPage>, id: string) =>
      wrapper.find(`[data-testid="${id}"]`);

    it("is one centred column at the panel's 576 px", () => {
      const page = byId(mountPage(), 'cart-page');

      expect(page.classes()).toEqual(
        expect.arrayContaining(['mx-auto', 'max-w-xl']),
      );
      expect(page.classes()).not.toContain('max-w-7xl');
      expect(page.find('.lg\\:flex-row').exists()).toBe(false);
    });

    it('puts the lines above the summary, the summary pinned to the bottom of the window', () => {
      const wrapper = mountPage();

      const lines = byId(wrapper, 'cart-items');
      const summary = byId(wrapper, 'cart-order-summary');
      expect(lines.findAll('[data-testid="cart-item"]')).toHaveLength(2);
      expect(
        lines.element.compareDocumentPosition(summary.element) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(summary.classes()).toEqual(
        expect.arrayContaining([
          'sticky',
          'bottom-0',
          'z-10',
          'bg-muted',
          'border-t',
        ]),
      );
      expect(summary.classes()).not.toContain('top-24');
    });

    it('draws a line between the rows and one under the last, on the list', () => {
      expect(byId(mountPage(), 'cart-items').classes()).toEqual(
        expect.arrayContaining(['divide-y', 'border-b']),
      );
    });

    it.each([
      [false, 'cart.prices_ex_vat'],
      [true, 'cart.prices_inc_vat'],
    ])(
      'states the VAT once under the title (incl. VAT: %s)',
      (incVat, text) => {
        mockShowIncVat.value = incVat;
        const wrapper = mountPage();

        const note = byId(wrapper, 'cart-vat-note');
        expect(note.text()).toBe(text);
        expect(
          byId(wrapper, 'cart-page-title').element.compareDocumentPosition(
            note.element,
          ) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      },
    );

    it.each([
      [true, 'common.vat_included'],
      [false, 'common.vat'],
    ])(
      'labels the VAT row by the chosen side (incl. VAT: %s)',
      (incVat, label) => {
        mockShowIncVat.value = incVat;
        const tax = byId(
          mountPage({
            ...mockCart,
            summary: {
              ...mockCart.summary,
              total: { ...mockCart.summary!.total, vatFormatted: '$17.23' },
            },
          } as CartType),
          'cart-summary-tax',
        );

        expect(tax.text()).toBe('$17.23');
        expect(tax.element.previousElementSibling?.textContent?.trim()).toBe(
          label,
        );
      },
    );

    it('says nothing of VAT where prices are hidden', () => {
      mockShowPrice.value = false;
      try {
        const wrapper = mountPage();
        expect(byId(wrapper, 'cart-items').exists()).toBe(true);
        expect(byId(wrapper, 'cart-vat-note').exists()).toBe(false);
      } finally {
        mockShowPrice.value = true;
      }
    });

    it('says nothing of VAT on an empty cart', () => {
      const wrapper = mountPage(null);

      expect(byId(wrapper, 'cart-page-empty').exists()).toBe(true);
      expect(byId(wrapper, 'cart-vat-note').exists()).toBe(false);
    });

    it('calls the subtotal "Delsumma" without the count, and lists the rows 8 px apart', () => {
      const summary = byId(mountPage(), 'cart-order-summary');

      expect(summary.text()).toContain('cart.subtotal');
      expect(summary.text()).not.toContain('cart.subtotal_items');
      expect(summary.find('dl').classes()).toContain('space-y-2');
    });

    describe("shipping and discount in the buyer's VAT choice", () => {
      const vatCart = () =>
        ({
          ...mockCart,
          summary: {
            ...mockCart.summary,
            total: { ...mockCart.summary.total, currency: { code: 'SEK' } },
            shipping: {
              ...mockCart.summary.shipping,
              feeIncVat: 62.5,
              feeIncVatFormatted: '62,50 kr',
              feeExVat: 50,
              feeExVatFormatted: '50,00 kr',
            },
            fixedAmountDiscountIncVat: 125,
            fixedAmountDiscountExVat: 100,
          },
        }) as unknown as CartType;

      it('shows them excluding VAT when the buyer chose that', () => {
        mockShowIncVat.value = false;
        const wrapper = mountPage(vatCart());

        expect(byId(wrapper, 'cart-summary-shipping').text()).toBe('50,00 kr');
        expect(byId(wrapper, 'cart-summary-discount-amount').text()).toMatch(
          /^-\D*100[,.]00/,
        );
      });

      it('shows them including VAT when the buyer chose that', () => {
        mockShowIncVat.value = true;
        const wrapper = mountPage(vatCart());

        expect(byId(wrapper, 'cart-summary-shipping').text()).toBe('62,50 kr');
        expect(byId(wrapper, 'cart-summary-discount-amount').text()).toMatch(
          /^-\D*125[,.]00/,
        );
      });
    });

    it('shows the total larger, on the baseline, in tabular figures', () => {
      const total = byId(mountPage(), 'cart-summary-total');

      expect(total.text()).toBe('$237.97');
      expect(total.classes()).toContain('tabular-nums');
      expect([...(total.element.parentElement?.classList ?? [])]).toEqual(
        expect.arrayContaining(['text-lg', 'font-semibold', 'items-baseline']),
      );
    });
  });
});

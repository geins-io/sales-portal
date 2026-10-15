import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';
import { shallowMountComponent } from '../../utils/component';
import CartDrawer from '../../../app/components/cart/CartDrawer.vue';
import type { CartType } from '../../../shared/types/commerce';
import { useCartStore } from '../../../app/stores/cart';
import { createPinia, setActivePinia } from 'pinia';
import { mockShowIncVat, mockIsCatalogMode } from '../../setup-components';

const mockShowPrice = ref(true);
vi.mock('../../../app/composables/usePriceVisibility', () => ({
  usePriceVisibility: () => ({ showPrice: mockShowPrice }),
}));

const mockCanAccess = vi.fn<(featureName: string) => boolean>(() => true);
vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canAccess: mockCanAccess }),
}));

describe('CartDrawer', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(useRouter().push).mockClear();
    mockCanAccess.mockReset();
    mockCanAccess.mockReturnValue(true);
    mockShowIncVat.value = true;
  });

  describe('catalog mode', () => {
    // The two halves of showDrawer are independent: either one alone must keep
    // the purchase funnel off the screen.
    const sheetStubs = {
      Sheet: {
        template: '<div data-testid="cart-sheet"><slot /></div>',
        props: ['open'],
      },
      SheetContent: { template: '<div><slot /></div>' },
      SheetHeader: { template: '<div><slot /></div>' },
      SheetTitle: { template: '<div><slot /></div>' },
      SheetDescription: { template: '<div><slot /></div>' },
      SheetFooter: { template: '<div><slot /></div>' },
      CartItem: true,
      CartPromoCodeInput: true,
    };

    afterEach(() => {
      mockIsCatalogMode.value = false;
    });

    it('does not render the drawer when mode is catalog', () => {
      const store = useCartStore();
      store.isOpen = true;
      mockIsCatalogMode.value = true;

      const wrapper = shallowMountComponent(CartDrawer, {
        global: { stubs: sheetStubs },
      });

      expect(wrapper.find('[data-testid="cart-sheet"]').exists()).toBe(false);
    });

    it('renders the drawer when mode is commerce and orderPlacement access is granted', () => {
      const store = useCartStore();
      store.isOpen = true;
      mockIsCatalogMode.value = false;
      mockCanAccess.mockImplementation(
        (name: string) => name === 'orderPlacement',
      );

      const wrapper = shallowMountComponent(CartDrawer, {
        global: { stubs: sheetStubs },
      });

      expect(wrapper.find('[data-testid="cart-sheet"]').exists()).toBe(true);
    });
  });

  it('does not render the drawer when orderPlacement access is denied', () => {
    const store = useCartStore();
    store.isOpen = true;
    mockCanAccess.mockImplementation(
      (name: string) => name !== 'orderPlacement',
    );

    const wrapper = shallowMountComponent(CartDrawer, {
      global: {
        stubs: {
          Sheet: {
            template: '<div data-testid="cart-sheet"><slot /></div>',
            props: ['open'],
          },
          SheetContent: { template: '<div><slot /></div>' },
          SheetHeader: { template: '<div><slot /></div>' },
          SheetTitle: { template: '<div><slot /></div>' },
          SheetDescription: { template: '<div><slot /></div>' },
          SheetFooter: { template: '<div><slot /></div>' },
          CartItem: true,
          CartPromoCodeInput: true,
        },
      },
    });

    expect(wrapper.find('[data-testid="cart-sheet"]').exists()).toBe(false);
  });

  it('asks the buyer to sign in, in place of the empty state, when the cart needs it', () => {
    const store = useCartStore();
    store.isOpen = true;
    store.needsSignIn = true;

    const wrapper = shallowMountComponent(CartDrawer, {
      global: {
        stubs: {
          Sheet: { template: '<div><slot /></div>', props: ['open'] },
          SheetContent: { template: '<div><slot /></div>' },
          SheetHeader: { template: '<div><slot /></div>' },
          SheetTitle: { template: '<div><slot /></div>' },
          SheetDescription: { template: '<div><slot /></div>' },
          SheetFooter: { template: '<div><slot /></div>' },
          CartItem: true,
          CartPromoCodeInput: true,
        },
      },
    });

    expect(wrapper.find('[data-testid="cart-sign-in"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cart-empty"]').exists()).toBe(false);
  });

  describe('a cart that could not be read', () => {
    const stubs = {
      Sheet: { template: '<div><slot /></div>', props: ['open'] },
      SheetContent: { template: '<div><slot /></div>' },
      SheetHeader: { template: '<div><slot /></div>' },
      SheetTitle: { template: '<div><slot /></div>' },
      SheetDescription: { template: '<div><slot /></div>' },
      SheetFooter: { template: '<div><slot /></div>' },
      CartLoadFailedNotice: { template: '<div data-testid="load-failed" />' },
      CartItem: { template: '<div data-testid="cart-line" />' },
      CartPromoCodeInput: true,
    };

    it('says so in place of the empty state when there are no lines to show', () => {
      const store = useCartStore();
      store.isOpen = true;
      store.loadFailed = true;

      const wrapper = shallowMountComponent(CartDrawer, {
        global: { stubs },
      });

      expect(wrapper.find('[data-testid="load-failed"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="cart-empty"]').exists()).toBe(false);
    });

    it('says so above the lines it still shows', () => {
      const store = useCartStore();
      store.isOpen = true;
      store.loadFailed = true;
      store.cart = {
        id: 'cart-1',
        items: [{ id: 'line-1', quantity: 1 }],
      } as unknown as CartType;

      const html = shallowMountComponent(CartDrawer, {
        global: { stubs },
      }).html();

      const notice = html.indexOf('data-testid="load-failed"');
      expect(notice).toBeGreaterThan(-1);
      expect(notice).toBeLessThan(html.indexOf('data-testid="cart-line"'));
    });
  });

  it('renders empty state when cart is empty', () => {
    const store = useCartStore();
    store.isOpen = true;

    const wrapper = shallowMountComponent(CartDrawer, {
      global: {
        stubs: {
          Sheet: { template: '<div><slot /></div>', props: ['open'] },
          SheetContent: { template: '<div><slot /></div>' },
          SheetHeader: { template: '<div><slot /></div>' },
          SheetTitle: { template: '<div><slot /></div>' },
          SheetDescription: { template: '<div><slot /></div>' },
          SheetFooter: { template: '<div><slot /></div>' },
          CartItem: true,
          CartPromoCodeInput: true,
        },
      },
    });

    expect(wrapper.find('[data-testid="cart-empty"]').exists()).toBe(true);
  });

  it('renders cart items when cart has items', () => {
    const store = useCartStore();
    store.isOpen = true;
    store.cart = {
      id: 'cart-123',
      items: [
        {
          id: 'item-1',
          skuId: 100,
          quantity: 1,
          product: {
            productId: '1',
            name: 'Product 1',
            alias: 'product-1',
            articleNumber: 'ART-1',
            brand: { name: 'Brand' },
            productImages: [],
            canonicalUrl: '/product-1',
            primaryCategory: { name: 'Cat' },
            skus: [],
            unitPrice: {
              sellingPriceIncVat: 100,
              sellingPriceIncVatFormatted: '100 kr',
            },
          },
          unitPrice: {
            sellingPriceIncVat: 100,
            sellingPriceIncVatFormatted: '100 kr',
          },
          totalPrice: {
            sellingPriceIncVat: 100,
            sellingPriceIncVatFormatted: '100 kr',
          },
        },
      ],
      freeShipping: false,
      completed: false,
      fixedDiscount: 0,
      appliedCampaigns: [],
      summary: {
        total: {
          sellingPriceIncVat: 100,
          sellingPriceIncVatFormatted: '100 kr',
        },
        subTotal: {
          sellingPriceIncVat: 100,
          sellingPriceIncVatFormatted: '100 kr',
        },
        vats: [],
        fees: {
          paymentFeeIncVat: 0,
          paymentFeeExVat: 0,
          shippingFeeIncVat: 0,
          shippingFeeExVat: 0,
        },
        balance: {
          pending: 0,
          pendingFormatted: '0 kr',
          totalSellingPriceExBalanceExVat: 100,
          totalSellingPriceExBalanceIncVat: 100,
          totalSellingPriceExBalanceIncVatFormatted: '100 kr',
        },
        shipping: {},
        payment: {},
      },
    } as unknown as CartType;

    const wrapper = shallowMountComponent(CartDrawer, {
      global: {
        stubs: {
          Sheet: { template: '<div><slot /></div>', props: ['open'] },
          SheetContent: { template: '<div><slot /></div>' },
          SheetHeader: { template: '<div><slot /></div>' },
          SheetTitle: { template: '<div><slot /></div>' },
          SheetDescription: { template: '<div><slot /></div>' },
          SheetFooter: { template: '<div><slot /></div>' },
          CartItem: {
            template: '<div data-testid="cart-item" />',
            props: ['item'],
          },
          CartPromoCodeInput: true,
        },
      },
    });

    expect(wrapper.find('[data-testid="cart-empty"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="cart-item"]').length).toBe(1);
  });

  describe('skip note', () => {
    const stubs = {
      Sheet: { template: '<div><slot /></div>', props: ['open'] },
      SheetContent: { template: '<div><slot /></div>' },
      SheetHeader: { template: '<div><slot /></div>' },
      SheetTitle: { template: '<div><slot /></div>' },
      SheetDescription: { template: '<div><slot /></div>' },
      SheetFooter: { template: '<div><slot /></div>' },
      CartItem: {
        template: '<div data-testid="cart-item" />',
        props: ['item'],
      },
      CartSkippedNote: { template: '<p data-testid="skipped-note" />' },
      CartPromoCodeInput: true,
    };

    it('sits above the cart lines', () => {
      const store = useCartStore();
      store.isOpen = true;
      store.cart = {
        id: 'cart-123',
        items: [{ id: 'item-1', skuId: 100, quantity: 1 }],
        appliedCampaigns: [],
        summary: {},
      } as unknown as CartType;

      const html = shallowMountComponent(CartDrawer, {
        global: { stubs },
      }).html();

      expect(html).toContain('data-testid="skipped-note"');
      expect(html.indexOf('data-testid="skipped-note"')).toBeLessThan(
        html.indexOf('data-testid="cart-item"'),
      );
    });

    it('sits above the empty state, for a bulk add that added nothing', () => {
      const store = useCartStore();
      store.isOpen = true;

      const html = shallowMountComponent(CartDrawer, {
        global: { stubs },
      }).html();

      expect(html).toContain('data-testid="cart-empty"');
      expect(html.indexOf('data-testid="skipped-note"')).toBeGreaterThan(-1);
      expect(html.indexOf('data-testid="skipped-note"')).toBeLessThan(
        html.indexOf('data-testid="cart-empty"'),
      );
    });
  });

  it('hands a configured line its configuration, next to an ordinary line', () => {
    const store = useCartStore();
    store.isOpen = true;
    const line = { skuId: 100, quantity: 1 };
    store.cart = {
      id: 'cart-123',
      items: [
        {
          ...line,
          id: 'item-1',
          configuration: {
            configurationId: 'committed-1',
            summary: [{ label: 'Adapter', value: 'S45' }],
          },
        },
        { ...line, id: 'item-2' },
      ],
      appliedCampaigns: [],
      summary: {},
    } as unknown as CartType;

    const wrapper = shallowMountComponent(CartDrawer, {
      global: {
        stubs: {
          Sheet: { template: '<div><slot /></div>', props: ['open'] },
          SheetContent: { template: '<div><slot /></div>' },
          SheetHeader: { template: '<div><slot /></div>' },
          SheetTitle: { template: '<div><slot /></div>' },
          SheetDescription: { template: '<div><slot /></div>' },
          SheetFooter: { template: '<div><slot /></div>' },
          CartItem: {
            template:
              '<div data-testid="cart-item">{{ item.configuration?.summary[0]?.value ?? "-" }}</div>',
            props: ['item'],
          },
          CartPromoCodeInput: true,
        },
      },
    });

    expect(
      wrapper.findAll('[data-testid="cart-item"]').map((item) => item.text()),
    ).toEqual(['S45', '-']);
  });

  describe('checkout button', () => {
    const buttonStub = {
      template:
        '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
      props: ['disabled', 'variant', 'size'],
      emits: ['click'],
    };

    const drawerStubs = {
      Button: buttonStub,
      UiButton: buttonStub,
      Sheet: { template: '<div><slot /></div>', props: ['open'] },
      SheetContent: { template: '<div><slot /></div>' },
      SheetHeader: { template: '<div><slot /></div>' },
      SheetTitle: { template: '<div><slot /></div>' },
      SheetDescription: { template: '<div><slot /></div>' },
      SheetFooter: { template: '<div><slot /></div>' },
      CartItem: {
        template: '<div data-testid="cart-item" />',
        props: ['item'],
      },
      CartPromoCodeInput: true,
    };

    const cartWithItems = {
      id: 'cart-123',
      items: [
        {
          id: 'item-1',
          skuId: 100,
          quantity: 1,
          product: {
            productId: '1',
            name: 'Product 1',
            alias: 'product-1',
            articleNumber: 'ART-1',
            brand: { name: 'Brand' },
            productImages: [],
            canonicalUrl: '/product-1',
            primaryCategory: { name: 'Cat' },
            skus: [],
            unitPrice: {
              sellingPriceIncVat: 100,
              sellingPriceIncVatFormatted: '100 kr',
            },
          },
          unitPrice: {
            sellingPriceIncVat: 100,
            sellingPriceIncVatFormatted: '100 kr',
          },
          totalPrice: {
            sellingPriceIncVat: 100,
            sellingPriceIncVatFormatted: '100 kr',
          },
        },
      ],
      freeShipping: false,
      completed: false,
      fixedDiscount: 0,
      appliedCampaigns: [],
      summary: {
        total: {
          sellingPriceIncVat: 100,
          sellingPriceIncVatFormatted: '100 kr',
        },
        subTotal: {
          sellingPriceIncVat: 100,
          sellingPriceIncVatFormatted: '100 kr',
        },
        vats: [],
        fees: {
          paymentFeeIncVat: 0,
          paymentFeeExVat: 0,
          shippingFeeIncVat: 0,
          shippingFeeExVat: 0,
        },
        balance: {
          pending: 0,
          pendingFormatted: '0 kr',
          totalSellingPriceExBalanceExVat: 100,
          totalSellingPriceExBalanceIncVat: 100,
          totalSellingPriceExBalanceIncVatFormatted: '100 kr',
        },
        shipping: {},
        payment: {},
      },
    } as unknown as CartType;

    it('checkout button is not disabled when cart has items', () => {
      const store = useCartStore();
      store.isOpen = true;
      store.cart = cartWithItems;

      const wrapper = shallowMountComponent(CartDrawer, {
        global: { stubs: drawerStubs },
      });

      const btn = wrapper.find('[data-testid="cart-drawer-checkout-button"]');
      expect(btn.exists()).toBe(true);
      expect(btn.attributes('disabled')).toBeUndefined();
    });

    it('checkout button closes drawer and navigates to /checkout', async () => {
      const store = useCartStore();
      store.isOpen = true;
      store.cart = cartWithItems;
      const router = useRouter();

      const wrapper = shallowMountComponent(CartDrawer, {
        global: { stubs: drawerStubs },
      });

      await wrapper
        .find('[data-testid="cart-drawer-checkout-button"]')
        .trigger('click');
      expect(store.isOpen).toBe(false);
      expect(router.push).toHaveBeenCalledWith('/se/en/checkout');
    });

    it('checkout button is disabled while a configured line is changing', () => {
      const store = useCartStore();
      store.isOpen = true;
      store.cart = cartWithItems;
      store.pendingQuantities.set('item-1', 3);

      const wrapper = shallowMountComponent(CartDrawer, {
        global: { stubs: drawerStubs },
      });

      const btn = wrapper.find('[data-testid="cart-drawer-checkout-button"]');
      expect(btn.attributes('disabled')).toBeDefined();
    });

    it('checkout button is disabled during loading', () => {
      const store = useCartStore();
      store.isOpen = true;
      store.cart = cartWithItems;
      store.isLoading = true;

      const wrapper = shallowMountComponent(CartDrawer, {
        global: { stubs: drawerStubs },
      });

      const btn = wrapper.find('[data-testid="cart-drawer-checkout-button"]');
      expect(btn.attributes('disabled')).toBeDefined();
    });
  });

  describe('discount line', () => {
    const sheetStubs = {
      Sheet: { template: '<div><slot /></div>', props: ['open'] },
      SheetContent: { template: '<div><slot /></div>' },
      SheetHeader: { template: '<div><slot /></div>' },
      SheetTitle: { template: '<div><slot /></div>' },
      SheetDescription: { template: '<div><slot /></div>' },
      SheetFooter: { template: '<div><slot /></div>' },
      CartItem: {
        template: '<div data-testid="cart-item" />',
        props: ['item'],
      },
      CartPromoCodeInput: true,
    };

    function makeCartWithDiscount(
      discount: number,
      campaigns: { name: string; hideTitle: boolean }[] = [],
    ) {
      return {
        id: 'cart-123',
        items: [
          {
            id: 'item-1',
            skuId: 100,
            quantity: 1,
            product: {
              productId: '1',
              name: 'Product',
              alias: 'product',
              articleNumber: 'ART-1',
              brand: { name: 'Brand' },
              productImages: [],
              canonicalUrl: '/product',
              primaryCategory: { name: 'Cat' },
              skus: [],
              unitPrice: {
                sellingPriceIncVat: 100,
                sellingPriceIncVatFormatted: '100 kr',
              },
            },
            unitPrice: {
              sellingPriceIncVat: 100,
              sellingPriceIncVatFormatted: '100 kr',
            },
            totalPrice: {
              sellingPriceIncVat: 100,
              sellingPriceIncVatFormatted: '100 kr',
            },
          },
        ],
        freeShipping: false,
        completed: false,
        fixedDiscount: discount,
        appliedCampaigns: campaigns,
        summary: {
          fixedAmountDiscountIncVat: discount,
          fixedAmountDiscountExVat: discount * 0.8,
          total: {
            sellingPriceIncVat: 100 - discount,
            sellingPriceIncVatFormatted: `${100 - discount} kr`,
            currency: { code: 'SEK', symbol: 'kr' },
          },
          subTotal: {
            sellingPriceIncVat: 100,
            sellingPriceIncVatFormatted: '100 kr',
          },
          vats: [],
          fees: {
            paymentFeeIncVat: 0,
            paymentFeeExVat: 0,
            shippingFeeIncVat: 0,
            shippingFeeExVat: 0,
          },
          balance: {
            pending: 0,
            pendingFormatted: '0 kr',
            totalSellingPriceExBalanceExVat: 80,
            totalSellingPriceExBalanceIncVat: 100,
            totalSellingPriceExBalanceIncVatFormatted: '100 kr',
          },
          shipping: {},
          payment: {},
        },
      } as unknown as CartType;
    }

    it('shows discount line when fixedAmountDiscountIncVat > 0', () => {
      const store = useCartStore();
      store.isOpen = true;
      store.cart = makeCartWithDiscount(50);

      const wrapper = shallowMountComponent(CartDrawer, {
        global: { stubs: sheetStubs },
      });

      const discountRow = wrapper.find('[data-testid="cart-summary-discount"]');
      expect(discountRow.exists()).toBe(true);
    });

    it('hides discount line when fixedAmountDiscountIncVat is 0', () => {
      const store = useCartStore();
      store.isOpen = true;
      store.cart = makeCartWithDiscount(0);

      const wrapper = shallowMountComponent(CartDrawer, {
        global: { stubs: sheetStubs },
      });

      expect(
        wrapper.find('[data-testid="cart-summary-discount"]').exists(),
      ).toBe(false);
    });

    it('shows cart-level campaign names', () => {
      const store = useCartStore();
      store.isOpen = true;
      store.cart = makeCartWithDiscount(50, [
        { name: 'Free shipping', hideTitle: false },
      ]);

      const wrapper = shallowMountComponent(CartDrawer, {
        global: { stubs: sheetStubs },
      });

      const campaigns = wrapper.find('[data-testid="cart-campaigns"]');
      expect(campaigns.exists()).toBe(true);
      expect(campaigns.text()).toContain('Free shipping');
    });
  });

  describe('VAT preference on subtotal and total', () => {
    const sheetStubs = {
      Sheet: { template: '<div><slot /></div>', props: ['open'] },
      SheetContent: { template: '<div><slot /></div>' },
      SheetHeader: { template: '<div><slot /></div>' },
      SheetTitle: { template: '<div><slot /></div>' },
      SheetDescription: { template: '<div><slot /></div>' },
      SheetFooter: { template: '<div><slot /></div>' },
      CartItem: {
        template: '<div data-testid="cart-item" />',
        props: ['item'],
      },
      CartPromoCodeInput: true,
    };

    const cartWithVatFields = {
      id: 'cart-123',
      items: [
        {
          id: 'item-1',
          skuId: 100,
          quantity: 1,
          product: {
            productId: '1',
            name: 'Product',
            alias: 'product',
            articleNumber: 'ART-1',
            brand: { name: 'Brand' },
            productImages: [],
            canonicalUrl: '/product',
            primaryCategory: { name: 'Cat' },
            skus: [],
            unitPrice: {
              sellingPriceIncVat: 125,
              sellingPriceIncVatFormatted: '125 kr',
            },
          },
          unitPrice: {
            sellingPriceIncVat: 125,
            sellingPriceIncVatFormatted: '125 kr',
          },
          totalPrice: {
            sellingPriceIncVat: 125,
            sellingPriceIncVatFormatted: '125 kr',
          },
        },
      ],
      freeShipping: false,
      completed: false,
      fixedDiscount: 0,
      appliedCampaigns: [],
      summary: {
        total: {
          sellingPriceIncVat: 125,
          sellingPriceIncVatFormatted: '125 kr',
          sellingPriceExVat: 100,
          sellingPriceExVatFormatted: '100 kr',
        },
        subTotal: {
          sellingPriceIncVat: 125,
          sellingPriceIncVatFormatted: '125 kr',
          sellingPriceExVat: 100,
          sellingPriceExVatFormatted: '100 kr',
        },
        vats: [],
        fees: {
          paymentFeeIncVat: 0,
          paymentFeeExVat: 0,
          shippingFeeIncVat: 0,
          shippingFeeExVat: 0,
        },
        balance: {
          pending: 0,
          pendingFormatted: '0 kr',
          totalSellingPriceExBalanceExVat: 100,
          totalSellingPriceExBalanceIncVat: 125,
          totalSellingPriceExBalanceIncVatFormatted: '125 kr',
        },
        shipping: {},
        payment: {},
      },
    } as unknown as CartType;

    it('shows incl-VAT subtotal and total when showIncVat is true', () => {
      mockShowIncVat.value = true;
      const store = useCartStore();
      store.isOpen = true;
      store.cart = cartWithVatFields;

      const wrapper = shallowMountComponent(CartDrawer, {
        global: { stubs: sheetStubs },
      });

      const summary = wrapper.find('[data-testid="cart-summary"]');
      expect(summary.text()).toContain('125 kr');
      expect(summary.text()).not.toContain('100 kr');
    });

    it('shows excl-VAT subtotal and total when showIncVat is false', () => {
      mockShowIncVat.value = false;
      const store = useCartStore();
      store.isOpen = true;
      store.cart = cartWithVatFields;

      const wrapper = shallowMountComponent(CartDrawer, {
        global: { stubs: sheetStubs },
      });

      expect(wrapper.find('[data-testid="cart-summary-subtotal"]').text()).toBe(
        '100 kr',
      );
      expect(wrapper.find('[data-testid="cart-summary-total"]').text()).toBe(
        '100 kr',
      );
    });

    it('shows no subtotal or total, not the inc amounts, when the ex amounts are missing', () => {
      mockShowIncVat.value = false;
      const store = useCartStore();
      store.isOpen = true;
      store.cart = {
        ...cartWithVatFields,
        summary: {
          ...cartWithVatFields.summary,
          subTotal: {
            sellingPriceIncVat: 125,
            sellingPriceIncVatFormatted: '125 kr',
          },
          total: {
            sellingPriceIncVat: 125,
            sellingPriceIncVatFormatted: '125 kr',
          },
        },
      } as unknown as CartType;

      const wrapper = shallowMountComponent(CartDrawer, {
        global: { stubs: sheetStubs },
      });

      expect(wrapper.find('[data-testid="cart-summary-subtotal"]').text()).toBe(
        '',
      );
      expect(wrapper.find('[data-testid="cart-summary-total"]').text()).toBe(
        '',
      );
    });

    describe('the amount to pay incl. VAT', () => {
      function mountWith(total: Record<string, unknown>) {
        const store = useCartStore();
        store.isOpen = true;
        store.cart = {
          ...cartWithVatFields,
          summary: { ...cartWithVatFields.summary, total },
        } as unknown as CartType;
        return shallowMountComponent(CartDrawer, {
          global: { stubs: sheetStubs },
        });
      }

      it('shows the inc-VAT total under the total on the ex side', () => {
        mockShowIncVat.value = false;
        const wrapper = mountWith(cartWithVatFields.summary!.total!);
        const line = wrapper.find('[data-testid="cart-summary-to-pay"]');

        expect(line.text()).toContain('common.to_pay_inc_vat');
        expect(line.text()).toContain('125 kr');
        expect(
          wrapper
            .find('[data-testid="cart-summary-total"]')
            .element.compareDocumentPosition(line.element) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      });

      it('shows no line on the inc side, where the total already is it', () => {
        mockShowIncVat.value = true;
        const wrapper = mountWith(cartWithVatFields.summary!.total!);

        expect(
          wrapper.find('[data-testid="cart-summary-to-pay"]').exists(),
        ).toBe(false);
      });

      it.each([
        [0, '0 kr'],
        [undefined, undefined],
      ])(
        'shows no line on the ex side when the inc total is %s',
        (sellingPriceIncVat, sellingPriceIncVatFormatted) => {
          mockShowIncVat.value = false;
          const wrapper = mountWith({
            sellingPriceExVat: 100,
            sellingPriceExVatFormatted: '100 kr',
            sellingPriceIncVat,
            sellingPriceIncVatFormatted,
          });

          expect(
            wrapper.find('[data-testid="cart-summary-to-pay"]').exists(),
          ).toBe(false);
        },
      );
    });
  });

  describe("laid out as the prototype's panel", () => {
    const stubs = {
      Sheet: { template: '<div><slot /></div>', props: ['open'] },
      SheetContent: { template: '<div><slot /></div>' },
      SheetHeader: { template: '<div><slot /></div>' },
      SheetTitle: { template: '<div><slot /></div>' },
      SheetDescription: { template: '<div><slot /></div>' },
      CartItem: {
        template: '<div data-testid="cart-item" />',
        props: ['item'],
      },
      CartSkippedNote: { template: '<p data-testid="skipped-note" />' },
    };

    function cartWith(summary: Record<string, unknown> = {}) {
      return {
        id: 'cart-123',
        items: [
          { id: 'item-1', skuId: 100, quantity: 1 },
          { id: 'item-2', skuId: 200, quantity: 3 },
        ],
        appliedCampaigns: [],
        summary: {
          subTotal: { sellingPriceIncVatFormatted: '500 kr' },
          total: {
            sellingPriceIncVatFormatted: '500 kr',
            vatFormatted: '100 kr',
          },
          shipping: { feeIncVatFormatted: '49 kr' },
          ...summary,
        },
      } as unknown as CartType;
    }

    function mountDrawer(cart: CartType | null = cartWith()) {
      const store = useCartStore();
      store.isOpen = true;
      store.cart = cart;
      return shallowMountComponent(CartDrawer, { global: { stubs } });
    }
    const byId = (wrapper: ReturnType<typeof mountDrawer>, id: string) =>
      wrapper.find(`[data-testid="${id}"]`);

    it('is one 576 px column at every width', () => {
      const content = byId(mountDrawer(), 'cart-drawer');

      expect(content.classes()).toEqual(
        expect.arrayContaining(['flex', 'flex-col', 'sm:max-w-xl']),
      );
      expect(content.classes()).not.toContain('sm:max-w-md');
      expect(content.classes()).not.toContain('lg:max-w-4xl');
    });

    it('scrolls the lines and keeps the summary outside the scroll, pinned at the bottom', () => {
      const wrapper = mountDrawer();

      const list = byId(wrapper, 'cart-drawer-list');
      expect(list.classes()).toEqual(
        expect.arrayContaining(['min-h-0', 'flex-1', 'overflow-y-auto']),
      );
      expect(list.findAll('[data-testid="cart-item"]')).toHaveLength(2);

      const summary = byId(wrapper, 'cart-summary');
      expect(list.element.contains(summary.element)).toBe(false);
      expect(summary.element.parentElement).toBe(list.element.parentElement);
      expect(summary.element.previousElementSibling).toBe(list.element);
      expect(summary.classes()).toEqual(
        expect.arrayContaining(['shrink-0', 'border-t', 'bg-muted']),
      );
      expect(byId(wrapper, 'cart-summary-card').exists()).toBe(false);
    });

    it('draws a line between the rows and one under the last, on the list', () => {
      const lines = byId(mountDrawer(), 'cart-items');

      expect(lines.classes()).toEqual(
        expect.arrayContaining(['divide-y', 'border-b']),
      );
      expect(lines.findAll('[data-testid="cart-item"]')).toHaveLength(2);
    });

    it('keeps the skip note at the top of the scrolling list', () => {
      const list = byId(mountDrawer(), 'cart-drawer-list');

      expect(list.element.firstElementChild?.getAttribute('data-testid')).toBe(
        'skipped-note',
      );
    });

    it.each([
      [false, 'cart.prices_ex_vat'],
      [true, 'cart.prices_inc_vat'],
    ])(
      'states the VAT once under the title (incl. VAT: %s)',
      (incVat, text) => {
        mockShowIncVat.value = incVat;
        const note = byId(mountDrawer(), 'cart-vat-note');

        expect(note.text()).toBe(text);
        expect(note.classes()).toEqual(
          expect.arrayContaining(['text-sm', 'text-muted-foreground']),
        );
      },
    );

    it('says nothing of VAT where prices are hidden', () => {
      mockShowPrice.value = false;
      try {
        const wrapper = mountDrawer();
        expect(byId(wrapper, 'cart-items').exists()).toBe(true);
        expect(byId(wrapper, 'cart-vat-note').exists()).toBe(false);
      } finally {
        mockShowPrice.value = true;
      }
    });

    describe('where prices are hidden', () => {
      const amountRows = [
        'cart-summary-subtotal',
        'cart-summary-discount',
        'cart-summary-shipping',
        'cart-summary-tax',
        'cart-summary-total',
        'cart-summary-to-pay',
      ];
      // Every row the summary can show, on the ex side so the amount to pay
      // incl. VAT appears too.
      const fullCart = () =>
        cartWith({
          subTotal: { sellingPriceExVatFormatted: '400 kr' },
          total: {
            sellingPriceExVatFormatted: '400 kr',
            sellingPriceIncVat: 500,
            sellingPriceIncVatFormatted: '500 kr',
            vatFormatted: '100 kr',
          },
          shipping: { feeIncVatFormatted: '49 kr', feeExVatFormatted: '39 kr' },
          fixedAmountDiscountIncVat: 50,
          fixedAmountDiscountExVat: 40,
        });

      beforeEach(() => {
        mockShowIncVat.value = false;
      });

      it('shows every amount row when prices are shown', () => {
        const wrapper = mountDrawer(fullCart());

        for (const id of amountRows) {
          expect(byId(wrapper, id).exists(), id).toBe(true);
        }
      });

      it('shows no amount in the summary', () => {
        mockShowPrice.value = false;
        try {
          const wrapper = mountDrawer(fullCart());
          const summary = byId(wrapper, 'cart-summary');

          expect(summary.exists()).toBe(true);
          for (const id of amountRows) {
            expect(byId(wrapper, id).exists(), id).toBe(false);
          }
          for (const amount of ['400 kr', '500 kr', '100 kr', '39 kr']) {
            expect(summary.text()).not.toContain(amount);
          }
          expect(byId(wrapper, 'cart-drawer-checkout-button').exists()).toBe(
            true,
          );
        } finally {
          mockShowPrice.value = true;
        }
      });
    });

    it('says nothing of VAT on an empty cart', () => {
      const wrapper = mountDrawer(null);

      expect(byId(wrapper, 'cart-empty').exists()).toBe(true);
      expect(byId(wrapper, 'cart-vat-note').exists()).toBe(false);
    });

    it('lists the summary rows 8 px apart and shows each one the cart has', () => {
      const wrapper = mountDrawer();

      expect(byId(wrapper, 'cart-summary').find('dl').classes()).toContain(
        'space-y-2',
      );
      expect(byId(wrapper, 'cart-summary-subtotal').text()).toBe('500 kr');
      expect(byId(wrapper, 'cart-summary-shipping').text()).toBe('49 kr');
      expect(byId(wrapper, 'cart-summary-tax').text()).toBe('100 kr');
    });

    it.each([
      [true, 'common.vat_included'],
      [false, 'common.vat'],
    ])(
      'labels the VAT row by the chosen side (incl. VAT: %s)',
      (incVat, label) => {
        mockShowIncVat.value = incVat;
        const tax = byId(mountDrawer(), 'cart-summary-tax');

        expect(tax.text()).toBe('100 kr');
        expect(tax.element.previousElementSibling?.textContent?.trim()).toBe(
          label,
        );
      },
    );

    it('says shipping may apply and leaves out VAT when the cart has neither', () => {
      const wrapper = mountDrawer(
        cartWith({
          total: { sellingPriceIncVatFormatted: '500 kr' },
          shipping: {},
        }),
      );

      const shipping = byId(wrapper, 'cart-summary-shipping');
      expect(shipping.text()).toBe('common.shipping_may_apply');
      expect(shipping.find('.text-muted-foreground').exists()).toBe(true);
      expect(byId(wrapper, 'cart-summary-tax').exists()).toBe(false);
    });

    describe("shipping and discount in the buyer's VAT choice", () => {
      const vatCart = () =>
        cartWith({
          total: {
            sellingPriceIncVatFormatted: '500 kr',
            currency: { code: 'SEK' },
          },
          shipping: {
            feeIncVat: 62.5,
            feeIncVatFormatted: '62,50 kr',
            feeExVat: 50,
            feeExVatFormatted: '50,00 kr',
          },
          fixedAmountDiscountIncVat: 125,
          fixedAmountDiscountExVat: 100,
        });

      it('shows them excluding VAT when the buyer chose that', () => {
        mockShowIncVat.value = false;
        const wrapper = mountDrawer(vatCart());

        expect(byId(wrapper, 'cart-summary-shipping').text()).toBe('50,00 kr');
        expect(byId(wrapper, 'cart-summary-discount-amount').text()).toMatch(
          /^-\D*100[,.]00/,
        );
      });

      it('shows them including VAT when the buyer chose that', () => {
        mockShowIncVat.value = true;
        const wrapper = mountDrawer(vatCart());

        expect(byId(wrapper, 'cart-summary-shipping').text()).toBe('62,50 kr');
        expect(byId(wrapper, 'cart-summary-discount-amount').text()).toMatch(
          /^-\D*125[,.]00/,
        );
      });

      it('formats the ex-VAT fee itself when the cart sends no text for it', () => {
        mockShowIncVat.value = false;
        const cart = vatCart();
        delete (cart.summary.shipping as { feeExVatFormatted?: string })
          .feeExVatFormatted;
        const wrapper = mountDrawer(cart);

        expect(byId(wrapper, 'cart-summary-shipping').text()).toMatch(
          /^\D*50[,.]00/,
        );
      });

      it('says shipping may apply in either choice when the cart has no fee yet', () => {
        mockShowIncVat.value = false;
        const wrapper = mountDrawer(
          cartWith({
            shipping: {
              feeIncVat: 0,
              feeIncVatFormatted: '',
              feeExVat: 0,
              feeExVatFormatted: '',
            },
          }),
        );

        expect(byId(wrapper, 'cart-summary-shipping').text()).toBe(
          'common.shipping_may_apply',
        );
      });
    });

    it('shows the total larger, on the baseline, in tabular figures', () => {
      const total = byId(mountDrawer(), 'cart-summary-total');

      expect(total.text()).toBe('500 kr');
      expect(total.classes()).toContain('tabular-nums');
      expect([...(total.element.parentElement?.classList ?? [])]).toEqual(
        expect.arrayContaining(['text-lg', 'font-semibold', 'items-baseline']),
      );
    });
  });
});

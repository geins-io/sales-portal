import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import CartDrawer from '../../../app/components/cart/CartDrawer.vue';
import type { CartType } from '../../../shared/types/commerce';
import { useCartStore } from '../../../app/stores/cart';
import { createPinia, setActivePinia } from 'pinia';
import { mockShowIncVat } from '../../setup-components';

const mockCanAccess = vi.fn(() => true);
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

      const summary = wrapper.find('[data-testid="cart-summary-card"]');
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

      const summary = wrapper.find('[data-testid="cart-summary-card"]');
      expect(summary.text()).toContain('100 kr');
      expect(summary.text()).not.toContain('125 kr');
    });

    it('falls back to incl-VAT when excl-VAT formatted is absent and showIncVat is false', () => {
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

      const summary = wrapper.find('[data-testid="cart-summary-card"]');
      expect(summary.text()).toContain('125 kr');
    });
  });
});

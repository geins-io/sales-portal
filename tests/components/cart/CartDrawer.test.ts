import { describe, it, expect, beforeEach } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import CartDrawer from '../../../app/components/cart/CartDrawer.vue';
import type { CartType } from '../../../shared/types/commerce';
import { useCartStore } from '../../../app/stores/cart';
import { createPinia, setActivePinia } from 'pinia';

describe('CartDrawer', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
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
});

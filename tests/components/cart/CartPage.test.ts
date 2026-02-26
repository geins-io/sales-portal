import { describe, it, expect, beforeEach } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import CartPage from '../../../app/components/pages/CartPage.vue';
import type { CartType } from '../../../shared/types/commerce';
import { useCartStore } from '../../../app/stores/cart';
import { createPinia, setActivePinia } from 'pinia';

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
    },
    subTotal: {
      sellingPriceIncVat: 229.97,
      sellingPriceIncVatFormatted: '$229.97',
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

const defaultStubs = {
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

  it('renders checkout button as disabled', () => {
    const store = useCartStore();
    store.cart = mockCart;

    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });

    const btn = wrapper.find('[data-testid="cart-checkout-button"]');
    expect(btn.exists()).toBe(true);
    expect(btn.attributes('disabled')).toBeDefined();
    expect(btn.text()).toContain('cart.proceed_to_checkout');
  });

  it('renders close button', () => {
    const wrapper = shallowMountComponent(CartPage, {
      global: { stubs: defaultStubs },
    });

    expect(wrapper.find('[data-testid="cart-page-close"]').exists()).toBe(true);
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
});

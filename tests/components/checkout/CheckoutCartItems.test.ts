import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountComponent } from '../../utils/component';
import CheckoutCartItems from '../../../app/components/checkout/CheckoutCartItems.vue';
import type { CartItemType } from '@geins/types';

// Mock the cart store
const mockUpdateQuantity = vi.fn();
const mockRemoveItem = vi.fn();

vi.mock('../../../app/stores/cart', () => ({
  useCartStore: () => ({
    updateQuantity: mockUpdateQuantity,
    removeItem: mockRemoveItem,
  }),
}));

const stubs = {
  GeinsImage: {
    template: '<img :data-file-name="fileName" />',
    props: ['fileName', 'type', 'alt', 'aspectRatio', 'sizes'],
  },
  PriceDisplay: {
    template:
      '<span data-testid="price-stub">{{ price?.sellingPriceIncVatFormatted ?? "" }}</span>',
    props: ['price'],
  },
  QuantityStepper: {
    template:
      '<div data-testid="checkout-quantity-stepper"><button data-testid="qty-decrement" @click="$emit(\'update:modelValue\', modelValue - 1)" /><span data-testid="qty-value">{{ modelValue }}</span><button data-testid="qty-increment" @click="$emit(\'update:modelValue\', modelValue + 1)" /></div>',
    props: ['modelValue', 'min'],
    emits: ['update:modelValue'],
  },
  Card: {
    template: '<div data-testid="card"><slot /></div>',
  },
  CardHeader: {
    template: '<div data-testid="card-header"><slot /></div>',
  },
  CardTitle: {
    template: '<h3><slot /></h3>',
  },
  CardContent: {
    template: '<div data-testid="card-content"><slot /></div>',
  },
  Button: {
    template:
      '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
    props: ['variant', 'size', 'type'],
    emits: ['click'],
  },
  Icon: {
    template: '<span class="icon" :data-name="name"></span>',
    props: ['name'],
  },
  NuxtIcon: {
    template: '<span class="icon" :data-name="name"></span>',
    props: ['name'],
  },
  ShoppingCart: {
    template: '<span class="icon-shopping-cart"></span>',
  },
};

function createItem(overrides: Partial<CartItemType> = {}): CartItemType {
  return {
    id: '1',
    skuId: 100,
    quantity: 2,
    title: 'Test Product',
    product: {
      name: 'Test Product',
      articleNumber: 'ART-001',
      productImages: [{ fileName: 'test-image.jpg' }],
      skus: [{ skuId: 100, name: 'Size M' }],
      canonicalUrl: '/test-product',
      alias: 'test-product',
    },
    totalPrice: {
      sellingPriceIncVatFormatted: '100.00 SEK',
      sellingPriceIncVat: 100,
      currency: { code: 'SEK' },
    },
    unitPrice: {
      sellingPriceIncVatFormatted: '50.00 SEK',
      sellingPriceIncVat: 50,
      currency: { code: 'SEK' },
    },
    ...overrides,
  } as CartItemType;
}

function mountItems(
  items: CartItemType[] = [],
  props: Record<string, unknown> = {},
) {
  return mountComponent(CheckoutCartItems, {
    props: { items, ...props },
    global: { stubs },
  });
}

beforeEach(() => {
  mockUpdateQuantity.mockReset();
  mockRemoveItem.mockReset();
});

describe('CheckoutCartItems', () => {
  it('renders nothing when items array is empty', () => {
    const wrapper = mountItems([]);
    expect(wrapper.findAll('[data-testid="checkout-cart-item"]')).toHaveLength(
      0,
    );
  });

  it('renders correct number of cart-item rows for 3 items', () => {
    const items = [
      createItem({ id: '1' }),
      createItem({
        id: '2',
        product: {
          ...createItem().product!,
          name: 'Product 2',
          articleNumber: 'ART-002',
        },
      }),
      createItem({
        id: '3',
        product: {
          ...createItem().product!,
          name: 'Product 3',
          articleNumber: 'ART-003',
        },
      }),
    ];
    const wrapper = mountItems(items);
    expect(wrapper.findAll('[data-testid="checkout-cart-item"]')).toHaveLength(
      3,
    );
  });

  it('displays product name for each item', () => {
    const wrapper = mountItems([
      createItem({ product: { ...createItem().product!, name: 'Widget Pro' } }),
    ]);
    expect(wrapper.text()).toContain('Widget Pro');
  });

  it('displays article number when available', () => {
    const wrapper = mountItems([createItem()]);
    expect(wrapper.text()).toContain('ART-001');
  });

  it('displays quantity for each item', () => {
    const wrapper = mountItems([createItem({ quantity: 5 })]);
    expect(wrapper.text()).toContain('5');
  });

  it('renders GeinsImage stub with correct fileName prop', () => {
    const wrapper = mountItems([createItem()]);
    const img = wrapper.find('img');
    expect(img.attributes('data-file-name')).toBe('test-image.jpg');
  });

  it('renders PriceDisplay stub with totalPrice prop', () => {
    const wrapper = mountItems([createItem()]);
    const prices = wrapper.findAll('[data-testid="price-stub"]');
    expect(prices.length).toBeGreaterThan(0);
    expect(prices[0].text()).toContain('100.00 SEK');
  });

  it('handles item with missing product data gracefully', () => {
    const item = createItem({
      product: undefined as unknown as CartItemType['product'],
    });
    const wrapper = mountItems([item]);
    expect(wrapper.find('[data-testid="checkout-cart-item"]').exists()).toBe(
      true,
    );
  });

  it('handles item with null product images gracefully', () => {
    const item = createItem({
      product: {
        ...createItem().product!,
        productImages: undefined,
      } as CartItemType['product'],
    });
    const wrapper = mountItems([item]);
    expect(wrapper.find('[data-testid="checkout-cart-item"]').exists()).toBe(
      true,
    );
  });

  it('has wrapper with correct data-testid', () => {
    const wrapper = mountItems([createItem()]);
    expect(wrapper.find('[data-testid="checkout-cart-items"]').exists()).toBe(
      true,
    );
  });

  it('displays SKU name when available', () => {
    const wrapper = mountItems([createItem()]);
    expect(wrapper.text()).toContain('Size M');
  });

  // C2: isEditable=false shows read-only quantity display
  it('(isEditable=false) shows "x N" quantity and no QuantityStepper or remove button', () => {
    const wrapper = mountItems([createItem({ quantity: 3 })], {
      isEditable: false,
    });
    expect(wrapper.text()).toContain('x 3');
    expect(
      wrapper.find('[data-testid="checkout-quantity-stepper"]').exists(),
    ).toBe(false);
    expect(wrapper.find('[data-testid="checkout-remove-item"]').exists()).toBe(
      false,
    );
  });

  // C2: isEditable=true shows QuantityStepper and remove button
  it('(isEditable=true) shows QuantityStepper and calls cartStore.removeItem on remove click', async () => {
    const item = createItem({ id: 'item-42', quantity: 2 });
    const wrapper = mountItems([item], { isEditable: true });

    expect(
      wrapper.find('[data-testid="checkout-quantity-stepper"]').exists(),
    ).toBe(true);

    const removeButton = wrapper.find('[data-testid="checkout-remove-item"]');
    expect(removeButton.exists()).toBe(true);

    await removeButton.trigger('click');
    expect(mockRemoveItem).toHaveBeenCalledWith('item-42');
  });

  // C3: shows unit price below row total when unitPrice is present
  it('shows unit price line when unitPrice is present', () => {
    const item = createItem({
      unitPrice: {
        sellingPriceIncVatFormatted: '50.00 SEK',
        sellingPriceIncVat: 50,
        currency: { code: 'SEK' },
      },
    });
    const wrapper = mountItems([item]);
    expect(wrapper.find('[data-testid="checkout-unit-price"]').exists()).toBe(
      true,
    );
  });

  // C3: does not render unit price line when unitPrice is absent
  it('does not render unit price line when unitPrice is absent', () => {
    const item = createItem({
      unitPrice: undefined as unknown as CartItemType['unitPrice'],
    });
    const wrapper = mountItems([item]);
    expect(wrapper.find('[data-testid="checkout-unit-price"]').exists()).toBe(
      false,
    );
  });
});

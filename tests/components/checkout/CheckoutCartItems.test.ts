import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import CheckoutCartItems from '../../../app/components/checkout/CheckoutCartItems.vue';
import type { CartItemType } from '@geins/types';

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

function mountItems(items: CartItemType[] = []) {
  return mountComponent(CheckoutCartItems, {
    props: { items },
    global: { stubs },
  });
}

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
    const price = wrapper.find('[data-testid="price-stub"]');
    expect(price.exists()).toBe(true);
    expect(price.text()).toContain('100.00 SEK');
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
});

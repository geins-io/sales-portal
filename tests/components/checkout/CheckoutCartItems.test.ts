import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import { reactive } from 'vue';
import { mountComponent } from '../../utils/component';
import CheckoutCartItems from '../../../app/components/checkout/CheckoutCartItems.vue';
import type {
  CartItemType,
  CartLineConfiguration,
} from '../../../shared/types/commerce';

// Mock the cart store
const mockUpdateQuantity = vi.fn();
const mockRemoveItem = vi.fn();

const lineState = reactive({
  pendingQuantities: new Map<string, number>(),
  updatingItems: new Set<string>(),
  quantityFailed: new Set<string>(),
});

vi.mock('../../../app/stores/cart', () => ({
  // Reactive, as a Pinia store is, so a test can change a line's state.
  useCartStore: () =>
    Object.assign(lineState, {
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
      '<div data-testid="checkout-quantity-stepper" :data-disabled="disabled"><button data-testid="qty-decrement" :disabled="disabled" @click="$emit(\'update:modelValue\', modelValue - 1)" /><span data-testid="qty-value">{{ modelValue }}</span><button data-testid="qty-increment" :disabled="disabled" @click="$emit(\'update:modelValue\', modelValue + 1)" /></div>',
    props: ['modelValue', 'min', 'disabled'],
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
    expect(prices[0]?.text()).toContain('100.00 SEK');
  });

  it('passes the line quantity with the total', () => {
    const item = createItem();
    const wrapper = mountComponent(CheckoutCartItems, {
      props: { items: [item] },
      global: {
        stubs: {
          ...stubs,
          PriceDisplay: {
            template:
              '<span :data-testid="testid" :data-quantity="quantity" />',
            props: ['price', 'quantity', 'testid'],
          },
        },
      },
    });
    const total = wrapper.find('[data-testid="checkout-line-total"]');
    expect(total.attributes('data-quantity')).toBe(String(item.quantity));
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
    const baseProduct = createItem().product;
    assert.isDefined(baseProduct);
    const item = createItem({
      // `productImages` is required on the type, and absent images are exactly
      // what this test drives through the component — so the impossible value
      // is the point here, and the cast says so rather than hiding a mistake.
      product: {
        ...baseProduct,
        productImages: undefined,
      } as unknown as CartItemType['product'],
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

  // C2: isEditable=false shows disabled stepper, no trash button, no "x qty" text
  it('(isEditable=false) shows disabled QuantityStepper and no remove button', () => {
    const wrapper = mountItems([createItem({ quantity: 3 })], {
      isEditable: false,
    });
    const stepper = wrapper.find('[data-testid="checkout-quantity-stepper"]');
    expect(stepper.exists()).toBe(true);
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

  // remove button sits above the prices with mb-2 spacing
  it('(isEditable=true) renders remove button above the prices with mb-2', () => {
    const wrapper = mountItems([createItem()], { isEditable: true });

    const removeButton = wrapper.find('[data-testid="checkout-remove-item"]');
    expect(removeButton.exists()).toBe(true);
    expect(removeButton.classes()).toContain('mb-2');

    const html = wrapper.html();
    const removeIndex = html.indexOf('checkout-remove-item');
    const priceIndex = html.indexOf('price-stub');
    const unitPriceIndex = html.indexOf('checkout-unit-price');
    expect(removeIndex).toBeGreaterThan(-1);
    expect(removeIndex).toBeLessThan(priceIndex);
    expect(removeIndex).toBeLessThan(unitPriceIndex);
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

  describe('a configured line', () => {
    const CONFIGURATION: CartLineConfiguration = {
      configurationId: 'committed-1',
      summary: [
        { label: 'Machine weight (7-20)', value: '12 t' },
        { label: 'Adapter', value: 'S45' },
      ],
    };

    // The cart's line, with the configuration the cart service merged in.
    function configuredItem(configuration = CONFIGURATION) {
      return { ...createItem(), configuration } as CartItemType;
    }

    it('says it is a configured product instead of the article line', () => {
      const wrapper = mountItems([configuredItem()]);

      expect(
        wrapper.find('[data-testid="checkout-cart-item-configured"]').text(),
      ).toBe('cart.configured_product');
      expect(wrapper.text()).not.toContain('Art nr.');
      expect(wrapper.text()).not.toContain('Size M');
    });

    it('shows the line total only', () => {
      const wrapper = mountItems([configuredItem()]);

      expect(
        wrapper
          .findAll('[data-testid="price-stub"]')
          .map((price) => price.text()),
      ).toEqual(['100.00 SEK']);
      expect(wrapper.find('[data-testid="checkout-unit-price"]').exists()).toBe(
        false,
      );
    });

    it('shows its summary, collapsed, under the line', async () => {
      const wrapper = mountItems([configuredItem()]);

      const row = wrapper.find('[data-testid="checkout-cart-item"]');
      const toggle = row.find('[data-testid="cart-item-configuration-toggle"]');
      expect(toggle.text()).toBe('cart.show_configuration');
      expect(toggle.attributes('aria-expanded')).toBe('false');

      await toggle.trigger('click');

      expect(
        row
          .findAll('[data-testid="cart-item-configuration-row"]')
          .map((line) => [line.find('dt').text(), line.find('dd').text()]),
      ).toEqual([
        ['Machine weight (7-20)', '12 t'],
        ['Adapter', 'S45'],
      ]);
    });

    it("offers no way to edit the line, which is the cart's alone", async () => {
      const wrapper = mountItems([configuredItem()]);

      await wrapper
        .find('[data-testid="cart-item-configuration-toggle"]')
        .trigger('click');

      expect(wrapper.find('[data-testid="cart-item-edit"]').exists()).toBe(
        false,
      );
      expect(wrapper.text()).not.toContain('cart.edit_configuration');
    });

    it('gives each line its own summary block', () => {
      const wrapper = mountItems([
        { ...configuredItem(), id: 'a' } as CartItemType,
        { ...configuredItem(), id: 'b' } as CartItemType,
      ]);

      const ids = wrapper
        .findAll('[data-testid="cart-item-configuration"]')
        .map((block) => block.attributes('id'));
      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(2);
    });

    it('keeps the quantity stepper and the remove button', () => {
      const wrapper = mountItems([configuredItem()], { isEditable: true });

      expect(
        wrapper.find('[data-testid="checkout-quantity-stepper"]').exists(),
      ).toBe(true);
      expect(
        wrapper.find('[data-testid="checkout-remove-item"]').exists(),
      ).toBe(true);
    });

    describe('while its quantity changes', () => {
      beforeEach(() => {
        lineState.pendingQuantities = new Map();
        lineState.updatingItems = new Set();
        lineState.quantityFailed = new Set();
      });

      const stepper = (wrapper: ReturnType<typeof mountItems>) =>
        wrapper.find('[data-testid="checkout-quantity-stepper"]');

      it('shows the quantity the buyer chose while it settles', () => {
        lineState.pendingQuantities.set('1', 5);
        const wrapper = mountItems([configuredItem()], { isEditable: true });

        expect(wrapper.find('[data-testid="qty-value"]').text()).toBe('5');
        expect(stepper(wrapper).attributes('data-disabled')).toBe('false');
      });

      it('spins beside the stepper, named for a screen reader, and holds the stepper and the remove button until the change answers', () => {
        lineState.pendingQuantities.set('1', 5);
        lineState.updatingItems.add('1');
        const wrapper = mountItems([configuredItem()], { isEditable: true });

        const updating = wrapper.find(
          '[data-testid="checkout-cart-item-updating"]',
        );
        expect(updating.attributes('role')).toBe('status');
        expect(
          updating.find('.animate-spin[aria-hidden="true"]').exists(),
        ).toBe(true);
        expect(updating.find('.sr-only').text()).toBe('cart.quantity_updating');
        expect(updating.text()).toBe('cart.quantity_updating');
        expect(stepper(wrapper).attributes('data-disabled')).toBe('true');
        expect(
          wrapper
            .find('[data-testid="checkout-remove-item"]')
            .attributes('disabled'),
        ).toBeDefined();
      });

      it('shows no spinner on a line that is not updating', () => {
        const wrapper = mountItems([configuredItem()], { isEditable: true });

        expect(
          wrapper.find('[data-testid="checkout-cart-item-updating"]').exists(),
        ).toBe(false);
      });

      it.each([
        ['a configured line', () => configuredItem()],
        ['an ordinary line', () => createItem()],
      ])(
        'says under %s that the change failed and the line is unchanged',
        (_case, item) => {
          lineState.quantityFailed.add('1');
          const wrapper = mountItems([item()], { isEditable: true });

          expect(
            wrapper
              .find('[data-testid="checkout-cart-item-quantity-error"]')
              .text(),
          ).toBe('cart.quantity_change_failed');
        },
      );

      it("shows the line's own quantity again beside the failure text", () => {
        lineState.quantityFailed.add('1');
        const wrapper = mountItems([configuredItem()], { isEditable: true });

        expect(
          wrapper
            .find('[data-testid="checkout-cart-item-quantity-error"]')
            .text(),
        ).toBe('cart.quantity_change_failed');
        expect(wrapper.find('[data-testid="qty-value"]').text()).toBe('2');
      });
    });

    it('offers the toggle on a line committed with the defaults only, and says so opened', async () => {
      const wrapper = mountItems([
        configuredItem({ configurationId: 'committed-1', summary: [] }),
      ]);

      expect(
        wrapper.find('[data-testid="checkout-cart-item-configured"]').exists(),
      ).toBe(true);
      await wrapper
        .find('[data-testid="cart-item-configuration-toggle"]')
        .trigger('click');

      expect(
        wrapper.find('[data-testid="cart-item-configuration-default"]').text(),
      ).toBe('cart.default_configuration');
    });

    it('leaves a plain line as it was', () => {
      const wrapper = mountItems([createItem()]);

      expect(
        wrapper.find('[data-testid="checkout-cart-item-configured"]').exists(),
      ).toBe(false);
      expect(
        wrapper.find('[data-testid="cart-item-configuration-toggle"]').exists(),
      ).toBe(false);
      expect(wrapper.text()).toContain('Art nr. ART-001');
    });
  });
});

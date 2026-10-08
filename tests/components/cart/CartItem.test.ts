import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from '../../../app/stores/cart';
import { mountComponent } from '../../utils/component';
import CartItem from '../../../app/components/cart/CartItem.vue';
import type { CartItemType } from '../../../shared/types/commerce';

const mockItem = {
  id: 'item-1',
  skuId: 100,
  quantity: 2,
  product: {
    productId: '1',
    name: 'Test Product',
    alias: 'test-product',
    articleNumber: 'ART-001',
    brand: { name: 'Test Brand' },
    productImages: [{ fileName: 'test.jpg' }],
    canonicalUrl: '/test-product',
    primaryCategory: { name: 'Category' },
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
    sellingPriceIncVat: 200,
    sellingPriceIncVatFormatted: '200 kr',
  },
};

describe('CartItem', () => {
  it('renders product name', () => {
    const wrapper = mountComponent(CartItem, {
      props: { item: mockItem },
      global: {
        stubs: {
          GeinsImage: true,
          PriceDisplay: { template: '<span />', props: ['price'] },
          QuantityInput: {
            template: '<div />',
            props: ['modelValue', 'min', 'max'],
          },
        },
      },
    });
    expect(wrapper.find('[data-testid="cart-item-name"]').text()).toBe(
      'Test Product',
    );
  });

  it('renders product image via GeinsImage', () => {
    const wrapper = mountComponent(CartItem, {
      props: { item: mockItem },
      global: {
        stubs: {
          GeinsImage: {
            template: '<img data-testid="geins-image" />',
            props: ['fileName', 'type', 'alt'],
          },
          PriceDisplay: { template: '<span />', props: ['price'] },
          QuantityInput: {
            template: '<div />',
            props: ['modelValue', 'min', 'max'],
          },
        },
      },
    });
    expect(wrapper.find('[data-testid="geins-image"]').exists()).toBe(true);
  });

  it('renders price display', () => {
    const wrapper = mountComponent(CartItem, {
      props: { item: mockItem },
      global: {
        stubs: {
          GeinsImage: true,
          PriceDisplay: {
            template: '<span data-testid="price" />',
            props: ['price'],
          },
          QuantityInput: {
            template: '<div />',
            props: ['modelValue', 'min', 'max'],
          },
        },
      },
    });
    expect(wrapper.findAll('[data-testid="price"]').length).toBeGreaterThan(0);
  });

  it('emits remove when remove button clicked', async () => {
    const wrapper = mountComponent(CartItem, {
      props: { item: mockItem },
      global: {
        stubs: {
          GeinsImage: true,
          PriceDisplay: { template: '<span />', props: ['price'] },
          QuantityInput: {
            template: '<div />',
            props: ['modelValue', 'min', 'max'],
          },
        },
      },
    });
    await wrapper.find('[data-testid="cart-item-remove"]').trigger('click');
    expect(wrapper.emitted('remove')).toBeTruthy();
    expect(wrapper.emitted('remove')![0]).toEqual(['item-1']);
  });

  it('sets a per-item aria-label on the remove button for screen readers', () => {
    const wrapper = mountComponent(CartItem, {
      props: { item: mockItem },
      global: {
        stubs: {
          GeinsImage: true,
          PriceDisplay: { template: '<span />', props: ['price'] },
          QuantityInput: {
            template: '<div />',
            props: ['modelValue', 'min', 'max'],
          },
        },
      },
    });
    const removeBtn = wrapper.find('[data-testid="cart-item-remove"]');
    expect(removeBtn.attributes('aria-label')).toBeTruthy();
    // Either the named variant (with product name interpolated) or the
    // generic fallback must be used — never an unlabelled icon button.
    const label = removeBtn.attributes('aria-label') ?? '';
    expect(
      label === 'cart.remove_item' || label.includes('cart.remove_item_named'),
    ).toBe(true);
  });

  it('renders article number', () => {
    const wrapper = mountComponent(CartItem, {
      props: { item: mockItem },
      global: {
        stubs: {
          GeinsImage: true,
          PriceDisplay: { template: '<span />', props: ['price'] },
          QuantityInput: {
            template: '<div />',
            props: ['modelValue', 'min', 'max'],
          },
        },
      },
    });
    expect(wrapper.text()).toContain('Art nr. ART-001');
  });

  it('passes the line quantity with the total', () => {
    const wrapper = mountComponent(CartItem, {
      props: { item: mockItem },
      global: {
        stubs: {
          GeinsImage: true,
          PriceDisplay: {
            template:
              '<span :data-testid="testid" :data-quantity="quantity" />',
            props: ['price', 'quantity', 'testid'],
          },
          QuantityInput: {
            template: '<div />',
            props: ['modelValue', 'min', 'max'],
          },
        },
      },
    });
    const total = wrapper.find('[data-testid="cart-item-total-price"]');
    expect(total.attributes('data-quantity')).toBe(String(mockItem.quantity));
  });

  describe('campaign badges', () => {
    const stubs = {
      GeinsImage: true,
      PriceDisplay: { template: '<span />', props: ['price'] },
      QuantityInput: {
        template: '<div />',
        props: ['modelValue', 'min', 'max'],
      },
    };

    it('shows campaign names when item has applied campaigns', () => {
      const itemWithCampaigns = {
        ...mockItem,
        campaign: {
          appliedCampaigns: [{ name: '10% off', hideTitle: false }],
          prices: [],
        },
      };
      const wrapper = mountComponent(CartItem, {
        props: { item: itemWithCampaigns },
        global: { stubs },
      });
      const badges = wrapper.findAll('[data-testid="cart-item-campaign"]');
      expect(badges.length).toBe(1);
      expect(badges[0]?.text()).toBe('10% off');
    });

    it('hides campaigns with hideTitle true', () => {
      const itemWithHidden = {
        ...mockItem,
        campaign: {
          appliedCampaigns: [{ name: 'Hidden', hideTitle: true }],
          prices: [],
        },
      };
      const wrapper = mountComponent(CartItem, {
        props: { item: itemWithHidden },
        global: { stubs },
      });
      expect(wrapper.findAll('[data-testid="cart-item-campaign"]').length).toBe(
        0,
      );
    });

    it('shows no badges when campaign data is undefined', () => {
      const wrapper = mountComponent(CartItem, {
        props: { item: mockItem },
        global: { stubs },
      });
      expect(wrapper.findAll('[data-testid="cart-item-campaign"]').length).toBe(
        0,
      );
    });
  });

  describe('a configured line', () => {
    const stubs = {
      GeinsImage: true,
      PriceDisplay: {
        template: '<span :data-testid="testid" />',
        props: ['price', 'testid'],
      },
      QuantityInput: {
        template: '<div />',
        props: ['modelValue', 'min', 'max'],
      },
    };

    /** The shape the cart sends for a line committed on the canary. */
    const configuredItem = {
      ...mockItem,
      configuration: {
        configurationId: 'committed-1',
        summary: [
          { label: 'Machine weight (7-20)', value: '12 t' },
          { label: 'Adapter', value: 'S45' },
          { label: 'Finish', value: '' },
        ],
      },
    };

    function mountLine(item: CartItemType) {
      return mountComponent(CartItem, { props: { item }, global: { stubs } });
    }

    const toggleOf = (wrapper: ReturnType<typeof mountLine>) =>
      wrapper.find('[data-testid="cart-item-configuration-toggle"]');
    const blockOf = (wrapper: ReturnType<typeof mountLine>) =>
      wrapper.find('[data-testid="cart-item-configuration"]');
    // `v-show`: the block is in the DOM either way, hidden by its style.
    const shown = (wrapper: ReturnType<typeof mountLine>) =>
      !blockOf(wrapper).attributes('style')?.includes('display: none');

    it('says it is a configured product instead of the article line', () => {
      const wrapper = mountLine(configuredItem);

      expect(wrapper.find('[data-testid="cart-item-configured"]').text()).toBe(
        'cart.configured_product',
      );
      expect(wrapper.text()).not.toContain('Art nr.');
    });

    it('names the product without a link, since editing a line is its own action', () => {
      useCartStore().cartId = 'cart-1';
      const wrapper = mountLine(configuredItem);

      const name = wrapper.find('[data-testid="cart-item-name"]');
      expect(name.text()).toBe('Test Product');
      expect(name.element.tagName).not.toBe('A');
      expect(
        wrapper.findAll('a').map((link) => link.attributes('data-testid')),
      ).toEqual(['cart-item-edit']);
    });

    describe('editing the line', () => {
      const editOf = (wrapper: ReturnType<typeof mountLine>) =>
        wrapper.find('[data-testid="cart-item-edit"]');

      beforeEach(() => {
        const cart = useCartStore();
        cart.cartId = 'cart-1';
        cart.isOpen = true;
      });

      /** The edit link precedes the toggle and sits outside the block. */
      function expectEditAboveToggle(wrapper: ReturnType<typeof mountLine>) {
        const edit = editOf(wrapper);
        expect(edit.text()).toBe('cart.edit_configuration');
        expect(
          edit.element.compareDocumentPosition(toggleOf(wrapper).element) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(blockOf(wrapper).element.contains(edit.element)).toBe(false);
      }

      it('offers to change the configuration above the toggle, whether the summary is closed or open', async () => {
        const wrapper = mountLine(configuredItem);

        expect(shown(wrapper)).toBe(false);
        expectEditAboveToggle(wrapper);

        await toggleOf(wrapper).trigger('click');

        expect(shown(wrapper)).toBe(true);
        expectEditAboveToggle(wrapper);
      });

      it('offers to change a line committed with the defaults only, above its toggle', () => {
        const wrapper = mountLine({
          ...configuredItem,
          configuration: { configurationId: 'committed-1', summary: [] },
        });

        expect(toggleOf(wrapper).text()).toBe('cart.show_configuration');
        expectEditAboveToggle(wrapper);
      });

      it("links to the product's canonical page with the cart and the line, so the canonical redirect cannot drop them", () => {
        const wrapper = mountLine(configuredItem);

        expect(editOf(wrapper).attributes('href')).toBe(
          '/se/en/p/test-product?cart=cart-1&line=item-1',
        );
      });

      it('closes the drawer on the way', async () => {
        const wrapper = mountLine(configuredItem);

        await editOf(wrapper).trigger('click');

        expect(useCartStore().isOpen).toBe(false);
      });

      it('offers nothing to change without a cart or a product page', () => {
        useCartStore().cartId = null;
        expect(editOf(mountLine(configuredItem)).exists()).toBe(false);

        useCartStore().cartId = 'cart-1';
        const product = { ...mockItem.product, canonicalUrl: '', alias: '' };
        expect(editOf(mountLine({ ...configuredItem, product })).exists()).toBe(
          false,
        );
      });

      it('offers nothing to change on an ordinary line', () => {
        expect(editOf(mountLine(mockItem)).exists()).toBe(false);
      });
    });

    it('shows the line total only', () => {
      const wrapper = mountLine(configuredItem);

      expect(
        wrapper.find('[data-testid="cart-item-total-price"]').exists(),
      ).toBe(true);
      expect(
        wrapper.find('[data-testid="cart-item-unit-price"]').exists(),
      ).toBe(false);
    });

    it('keeps the configuration collapsed until the buyer opens it', () => {
      const wrapper = mountLine(configuredItem);

      const toggle = toggleOf(wrapper);
      expect(toggle.text()).toBe('cart.show_configuration');
      expect(toggle.attributes('aria-expanded')).toBe('false');
      expect(toggle.attributes('aria-controls')).toBe(
        blockOf(wrapper).attributes('id'),
      );
      expect(shown(wrapper)).toBe(false);
    });

    it('opens and closes the configuration from the toggle', async () => {
      const wrapper = mountLine(configuredItem);

      await toggleOf(wrapper).trigger('click');

      expect(toggleOf(wrapper).text()).toBe('cart.hide_configuration');
      expect(toggleOf(wrapper).attributes('aria-expanded')).toBe('true');
      expect(shown(wrapper)).toBe(true);

      await toggleOf(wrapper).trigger('click');

      expect(toggleOf(wrapper).attributes('aria-expanded')).toBe('false');
      expect(shown(wrapper)).toBe(false);
    });

    it('lists every summary row as label and value, in the order the cart sends them', () => {
      const wrapper = mountLine(configuredItem);

      const rows = blockOf(wrapper).findAll(
        '[data-testid="cart-item-configuration-row"]',
      );
      expect(
        rows.map((row) => [row.find('dt').text(), row.find('dd').text()]),
      ).toEqual([
        ['Machine weight (7-20)', '12 t'],
        ['Adapter', 'S45'],
        ['Finish', ''],
      ]);
    });

    it('keeps a row whose value is empty', () => {
      const wrapper = mountLine(configuredItem);

      const last = blockOf(wrapper)
        .findAll('[data-testid="cart-item-configuration-row"]')
        .at(-1);
      expect(last?.find('dt').text()).toBe('Finish');
      expect(last?.find('dd').exists()).toBe(true);
    });

    it('offers the toggle on a line committed with the defaults only, and says so opened', async () => {
      const wrapper = mountLine({
        ...mockItem,
        configuration: { configurationId: 'committed-1', summary: [] },
      });

      expect(
        wrapper.find('[data-testid="cart-item-configured"]').exists(),
      ).toBe(true);
      expect(shown(wrapper)).toBe(false);

      await toggleOf(wrapper).trigger('click');

      expect(shown(wrapper)).toBe(true);
      expect(
        blockOf(wrapper)
          .find('[data-testid="cart-item-configuration-default"]')
          .text(),
      ).toBe('cart.default_configuration');
    });

    it('leaves an ordinary line as it was', () => {
      const wrapper = mountLine(mockItem);

      expect(
        wrapper.find('[data-testid="cart-item-configured"]').exists(),
      ).toBe(false);
      expect(toggleOf(wrapper).exists()).toBe(false);
      expect(wrapper.text()).toContain('Art nr. ART-001');
      expect(wrapper.find('a').exists()).toBe(true);
      expect(
        wrapper.find('[data-testid="cart-item-unit-price"]').exists(),
      ).toBe(true);
    });

    it('gives each line its own block id', () => {
      const first = blockOf(mountLine(configuredItem)).attributes('id');
      const second = blockOf(
        mountLine({ ...configuredItem, id: 'item-2' }),
      ).attributes('id');

      expect(first).toBeTruthy();
      expect(first).not.toBe(second);
    });
  });

  describe('while its quantity changes', () => {
    const stubs = {
      GeinsImage: true,
      PriceDisplay: { template: '<span />', props: ['price'] },
      QuantityInput: {
        template:
          '<div data-testid="quantity-stub" :data-value="modelValue" :data-disabled="String(!!disabled)" />',
        props: ['modelValue', 'min', 'max', 'disabled'],
      },
    };
    const configuredItem = {
      ...mockItem,
      configuration: { configurationId: 'committed-1', summary: [] },
    };

    beforeEach(() => {
      const cart = useCartStore();
      cart.pendingQuantities = new Map();
      cart.updatingItems = new Set();
      cart.quantityFailed = new Set();
    });

    function mountLine(item: CartItemType = configuredItem) {
      const cart = useCartStore();
      cart.cartId = 'cart-1';
      return mountComponent(CartItem, { props: { item }, global: { stubs } });
    }

    const quantity = (wrapper: ReturnType<typeof mountLine>) =>
      wrapper.find('[data-testid="quantity-stub"]');

    it('shows the quantity the buyer chose while it settles', () => {
      useCartStore().pendingQuantities.set('item-1', 5);
      const wrapper = mountLine();

      expect(quantity(wrapper).attributes('data-value')).toBe('5');
      expect(quantity(wrapper).attributes('data-disabled')).toBe('false');
      expect(wrapper.find('[data-testid="cart-item-updating"]').exists()).toBe(
        false,
      );
    });

    it("shows the line's own quantity when nothing is pending", () => {
      const wrapper = mountLine();

      expect(quantity(wrapper).attributes('data-value')).toBe('2');
    });

    it('spins beside the quantity, named for a screen reader, and holds every control on the line until the change answers', () => {
      const cart = useCartStore();
      cart.pendingQuantities.set('item-1', 5);
      cart.updatingItems.add('item-1');
      const wrapper = mountLine();

      const updating = wrapper.find('[data-testid="cart-item-updating"]');
      expect(updating.attributes('role')).toBe('status');
      expect(updating.find('.animate-spin[aria-hidden="true"]').exists()).toBe(
        true,
      );
      // The words are for a screen reader only; the spinner is what shows.
      expect(updating.find('.sr-only').text()).toBe('cart.quantity_updating');
      expect(updating.text()).toBe('cart.quantity_updating');
      expect(updating.element.parentElement).toBe(
        quantity(wrapper).element.parentElement,
      );
      expect(quantity(wrapper).attributes('data-disabled')).toBe('true');
      expect(
        wrapper.find('[data-testid="cart-item-remove"]').attributes('disabled'),
      ).toBeDefined();
      const edit = wrapper.find('[data-testid="cart-item-edit"]');
      expect(edit.attributes('aria-disabled')).toBe('true');
      expect(edit.attributes('tabindex')).toBe('-1');
    });

    it('holds nothing on another line', () => {
      useCartStore().updatingItems.add('item-9');
      const wrapper = mountLine();

      expect(quantity(wrapper).attributes('data-disabled')).toBe('false');
      expect(
        wrapper.find('[data-testid="cart-item-remove"]').attributes('disabled'),
      ).toBeUndefined();
      expect(
        wrapper
          .find('[data-testid="cart-item-edit"]')
          .attributes('aria-disabled'),
      ).toBeUndefined();
    });

    it.each([
      ['a configured line', configuredItem],
      ['an ordinary line', mockItem],
    ])(
      'says under %s that the change failed and the line is unchanged',
      (_case, item) => {
        useCartStore().quantityFailed.add('item-1');
        const wrapper = mountLine(item);

        expect(
          wrapper.find('[data-testid="cart-item-quantity-error"]').text(),
        ).toBe('cart.quantity_change_failed');
      },
    );

    it('says nothing of a failure on a line that has none', () => {
      const wrapper = mountLine();

      expect(
        wrapper.find('[data-testid="cart-item-quantity-error"]').exists(),
      ).toBe(false);
    });
  });
});

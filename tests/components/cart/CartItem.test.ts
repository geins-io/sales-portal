import { describe, it, expect } from 'vitest';
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
      const wrapper = mountLine(configuredItem);

      const name = wrapper.find('[data-testid="cart-item-name"]');
      expect(name.text()).toBe('Test Product');
      expect(name.element.tagName).not.toBe('A');
      expect(wrapper.find('a').exists()).toBe(false);
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

    it('renders a configured line without a summary without the block', () => {
      const wrapper = mountLine({
        ...mockItem,
        configuration: { configurationId: 'committed-1', summary: [] },
      });

      expect(
        wrapper.find('[data-testid="cart-item-configured"]').exists(),
      ).toBe(true);
      expect(toggleOf(wrapper).exists()).toBe(false);
      expect(blockOf(wrapper).exists()).toBe(false);
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
});

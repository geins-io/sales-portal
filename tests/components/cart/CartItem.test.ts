import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ImageOff } from 'lucide-vue-next';
import { useCartStore } from '../../../app/stores/cart';
import { mountComponent } from '../../utils/component';
import { mockShowIncVat } from '../../setup-components';
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

    const showOf = (wrapper: ReturnType<typeof mountLine>) =>
      wrapper.find('[data-testid="line-specification-open"]');
    const actionsOf = (wrapper: ReturnType<typeof mountLine>) =>
      wrapper.find('[data-testid="cart-item-configuration-actions"]');

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

    it('hands the specification the line: its name, quantity, configuration and prices', () => {
      const wrapper = mountLine(configuredItem);

      const show = wrapper.findComponent({ name: 'LineSpecification' });
      expect(show.props()).toEqual({
        id: 'cart-item-configuration-item-1',
        productName: 'Test Product',
        quantity: 2,
        configuration: configuredItem.configuration,
        unitPrice: mockItem.unitPrice,
        totalPrice: mockItem.totalPrice,
      });
    });

    it('gives each line its own trigger id', () => {
      const first = showOf(mountLine(configuredItem)).attributes('id');
      const second = showOf(
        mountLine({ ...configuredItem, id: 'item-2' }),
      ).attributes('id');

      expect(first).toBeTruthy();
      expect(first).not.toBe(second);
    });

    it('offers the specification on a line committed with the defaults only', () => {
      const wrapper = mountLine({
        ...mockItem,
        configuration: { configurationId: 'committed-1', summary: [] },
      });

      expect(showOf(wrapper).exists()).toBe(true);
    });

    describe('editing the line', () => {
      const editOf = (wrapper: ReturnType<typeof mountLine>) =>
        wrapper.find('[data-testid="cart-item-edit"]');

      beforeEach(() => {
        const cart = useCartStore();
        cart.cartId = 'cart-1';
        cart.isOpen = true;
      });

      it('puts "Visa konfiguration" and then "Ändra konfiguration" on one row, as small outline buttons', () => {
        const wrapper = mountLine(configuredItem);

        const actions = actionsOf(wrapper);
        expect(actions.classes()).toEqual(
          expect.arrayContaining(['flex', 'flex-wrap', 'gap-2']),
        );
        const [show, edit] = actions.element.children;
        expect(show).toBe(showOf(wrapper).element);
        expect(edit).toBe(editOf(wrapper).element);
        expect(editOf(wrapper).text()).toBe('cart.edit_configuration');
        expect(editOf(wrapper).classes()).toEqual(
          expect.arrayContaining(['h-6', 'px-2', 'text-[11px]', 'border']),
        );
      });

      it('offers both on a line committed with the defaults only', () => {
        const wrapper = mountLine({
          ...configuredItem,
          configuration: { configurationId: 'committed-1', summary: [] },
        });

        expect(actionsOf(wrapper).element.children).toHaveLength(2);
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

      it('leaves the drawer open when the specification is shown', async () => {
        const wrapper = mountLine(configuredItem);

        await showOf(wrapper).trigger('click');

        expect(useCartStore().isOpen).toBe(true);
      });

      it('offers nothing to change without a cart or a product page, and still shows the specification', () => {
        useCartStore().cartId = null;
        const withoutCart = mountLine(configuredItem);
        expect(editOf(withoutCart).exists()).toBe(false);
        expect(showOf(withoutCart).exists()).toBe(true);

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

    it('leaves an ordinary line as it was', () => {
      const wrapper = mountLine(mockItem);

      expect(
        wrapper.find('[data-testid="cart-item-configured"]').exists(),
      ).toBe(false);
      expect(showOf(wrapper).exists()).toBe(false);
      expect(actionsOf(wrapper).exists()).toBe(false);
      expect(wrapper.text()).toContain('Art nr. ART-001');
      expect(wrapper.find('a').exists()).toBe(true);
      expect(
        wrapper.find('[data-testid="cart-item-unit-price"]').exists(),
      ).toBe(true);
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

  describe("laid out as the prototype's line", () => {
    const stubs = {
      GeinsImage: {
        template: '<img data-testid="geins-image" :data-sizes="sizes" />',
        props: ['fileName', 'sizes'],
      },
      PriceDisplay: {
        template:
          '<span :data-testid="testid" :data-vat-label="String(vatLabel)" />',
        props: ['price', 'quantity', 'testid', 'vatLabel'],
      },
      QuantityInput: {
        template: '<div data-testid="quantity-stub" />',
        props: ['modelValue', 'min', 'max', 'disabled'],
      },
    };
    const configuredItem = {
      ...mockItem,
      configuration: { configurationId: 'committed-1', summary: [] },
    };

    beforeEach(() => {
      useCartStore().cartId = 'cart-1';
      mockShowIncVat.value = false;
    });
    afterEach(() => {
      mockShowIncVat.value = true;
    });

    function mountLine(item: CartItemType = mockItem) {
      return mountComponent(CartItem, { props: { item }, global: { stubs } });
    }
    const byId = (wrapper: ReturnType<typeof mountLine>, id: string) =>
      wrapper.find(`[data-testid="${id}"]`);

    it('shows the image at 80 px in a thin border, and asks for it at 80 px so it stays sharp', () => {
      const wrapper = mountLine();

      const image = byId(wrapper, 'cart-item-image');
      expect(image.classes()).toEqual(
        expect.arrayContaining(['size-20', 'rounded-md', 'border']),
      );
      expect(byId(wrapper, 'geins-image').attributes('data-sizes')).toBe(
        '80px',
      );
    });

    it('keeps the placeholder at 80 px on a line without an image', () => {
      const wrapper = mountLine({
        ...mockItem,
        product: { ...mockItem.product, productImages: [] },
      });

      const image = byId(wrapper, 'cart-item-image');
      expect(image.classes()).toEqual(
        expect.arrayContaining(['size-20', 'border']),
      );
      expect(byId(wrapper, 'geins-image').exists()).toBe(false);
      expect(image.findComponent(ImageOff).classes()).toContain('size-8');
    });

    it('draws its own divider underneath, so the last line has one too, 20 px from the content', () => {
      const line = byId(mountLine(), 'cart-item');

      expect(line.classes()).toEqual(
        expect.arrayContaining(['border-b', 'py-5']),
      );
    });

    it.each([
      ['an ordinary line', mockItem, ['cart-item-name', 'cart-item-remove']],
      [
        'a configured line',
        configuredItem,
        [
          'cart-item-name',
          'cart-item-configured',
          'cart-item-remove',
          'cart-item-configuration-actions',
        ],
      ],
    ])(
      'puts everything on %s but the image in one column beside it, 12 px between its rows',
      (_case, item, inside) => {
        const wrapper = mountLine(item);

        const info = byId(wrapper, 'cart-item-info');
        expect(info.classes()).toContain('space-y-3');
        for (const id of [
          ...inside,
          'quantity-stub',
          'cart-item-total-price',
        ]) {
          expect(info.find(`[data-testid="${id}"]`).exists(), id).toBe(true);
        }
        const image = byId(wrapper, 'cart-item-image');
        expect(info.element.contains(image.element)).toBe(false);
        expect(image.element.parentElement).toBe(info.element.parentElement);
        expect(image.element.parentElement?.classList).toContain('gap-4');
      },
    );

    it('names the product at 16 px over a 14 px second line, and an ordinary line still links to its product', () => {
      const wrapper = mountLine();

      const name = byId(wrapper, 'cart-item-name');
      expect(name.element.tagName).toBe('A');
      expect(name.classes()).toContain('font-medium');
      expect(name.classes()).not.toContain('text-sm');
      expect(byId(wrapper, 'cart-item-article').classes()).toContain('text-sm');
    });

    it('says "Konfigurerad produkt" at 14 px on a configured line', () => {
      const wrapper = mountLine(configuredItem);

      expect(byId(wrapper, 'cart-item-configured').classes()).toContain(
        'text-sm',
      );
      expect(byId(wrapper, 'cart-item-name').classes()).not.toContain(
        'text-sm',
      );
    });

    it('puts the quantity on the left and the line price on the right of one row', () => {
      const wrapper = mountLine(configuredItem);

      const row = byId(wrapper, 'cart-item-price-row');
      expect(row.classes()).toContain('justify-between');
      const [left, right] = row.element.children;
      expect(left?.contains(byId(wrapper, 'quantity-stub').element)).toBe(true);
      expect(
        right?.contains(byId(wrapper, 'cart-item-total-price').element),
      ).toBe(true);
    });

    it('shows the line price at 16 px in tabular figures, then "Exkl. moms" in normal weight 6 px after it', () => {
      const wrapper = mountLine(configuredItem);

      const total = byId(wrapper, 'cart-item-total-price');
      expect(total.classes()).toEqual(
        expect.arrayContaining(['text-base', 'font-semibold', 'tabular-nums']),
      );
      expect(total.attributes('data-vat-label')).toBe('false');
      const vat = byId(wrapper, 'cart-item-vat');
      expect(vat.text()).toBe('common.vat_excl');
      expect(vat.classes()).toEqual(
        expect.arrayContaining(['ml-1.5', 'text-xs', 'text-muted-foreground']),
      );
      expect(vat.classes()).not.toContain('font-semibold');
    });

    it('says "Inkl. moms" after the price when the buyer shows prices including VAT', () => {
      mockShowIncVat.value = true;
      const wrapper = mountLine(configuredItem);

      expect(byId(wrapper, 'cart-item-vat').text()).toBe('common.vat_incl');
    });

    it("keeps an ordinary line's unit price, under its total", () => {
      const wrapper = mountLine();

      const price = byId(wrapper, 'cart-item-price-row').element.children[1];
      expect(
        price?.contains(byId(wrapper, 'cart-item-unit-price').element),
      ).toBe(true);
    });

    it('says the VAT word once on an ordinary line, after the total and not after the unit price', () => {
      const wrapper = mountLine();

      expect(
        byId(wrapper, 'cart-item-unit-price').attributes('data-vat-label'),
      ).toBe('false');
      expect(byId(wrapper, 'cart-item-vat').text()).toBe('common.vat_excl');
    });

    it('sets the trash button up and out into the corner', () => {
      const remove = byId(mountLine(), 'cart-item-remove');

      expect(remove.classes()).toEqual(
        expect.arrayContaining(['-mt-1', '-mr-2']),
      );
    });
  });
});

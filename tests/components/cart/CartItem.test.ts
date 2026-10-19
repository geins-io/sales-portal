import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';
import { ImageOff } from 'lucide-vue-next';
import { useCartStore } from '../../../app/stores/cart';
import { mountComponent } from '../../utils/component';
import { mockShowIncVat } from '../../setup-components';
import CartItem from '../../../app/components/cart/CartItem.vue';
import type { CartItemType } from '../../../shared/types/commerce';

// The shared mock drops a parameter its key does not name; here the key is
// followed by the values, so a test can read the price a phrase was given.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}(${Object.values(params).join(', ')})` : key,
    locale: ref('en'),
  }),
}));

const mockShowPrice = ref(true);
vi.mock('../../../app/composables/usePriceVisibility', () => ({
  usePriceVisibility: () => ({ showPrice: mockShowPrice }),
}));

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
          QuantityInput: {
            template: '<div />',
            props: ['modelValue', 'min', 'max'],
          },
        },
      },
    });
    expect(wrapper.find('[data-testid="geins-image"]').exists()).toBe(true);
  });

  describe('thumbnail', () => {
    const stubs = {
      GeinsImage: {
        template:
          '<img data-testid="thumb" :data-file="fileName" :data-url="url" />',
        props: ['fileName', 'url', 'type', 'alt', 'sizes', 'widths'],
      },
      QuantityInput: {
        template: '<div />',
        props: ['modelValue', 'min', 'max'],
      },
    };
    const withImages = (
      productImages: { fileName: string; url?: string | null }[],
    ) => ({
      ...mockItem,
      product: { ...mockItem.product, productImages },
    });

    it('passes the library url of the first image', () => {
      const thumb = mountComponent(CartItem, {
        props: {
          item: withImages([
            {
              fileName: 'test.jpg',
              url: 'https://cdn.litium.media/acme/products/test-image.jpg',
            },
          ]),
        },
        global: { stubs },
      }).find('[data-testid="thumb"]');
      expect(thumb.attributes('data-file')).toBe('test.jpg');
      expect(thumb.attributes('data-url')).toBe(
        'https://cdn.litium.media/acme/products/test-image.jpg',
      );
    });

    it('passes no library url for an image outside the library', () => {
      const thumb = mountComponent(CartItem, {
        props: { item: withImages([{ fileName: 'test.jpg', url: null }]) },
        global: { stubs },
      }).find('[data-testid="thumb"]');
      expect(thumb.attributes('data-file')).toBe('test.jpg');
      expect(thumb.attributes('data-url')).toBeUndefined();
    });
  });

  it('renders the line total', () => {
    const wrapper = mountComponent(CartItem, {
      props: { item: mockItem },
      global: {
        stubs: {
          GeinsImage: true,
          QuantityInput: {
            template: '<div />',
            props: ['modelValue', 'min', 'max'],
          },
        },
      },
    });
    expect(wrapper.find('[data-testid="cart-item-total-price"]').text()).toBe(
      '200 kr',
    );
  });

  it('emits remove when remove button clicked', async () => {
    const wrapper = mountComponent(CartItem, {
      props: { item: mockItem },
      global: {
        stubs: {
          GeinsImage: true,
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
          QuantityInput: {
            template: '<div />',
            props: ['modelValue', 'min', 'max'],
          },
        },
      },
    });
    expect(wrapper.text()).toContain('product.article_number(ART-001)');
  });

  it("judges the total's discount by the line quantity, so a CPQ rounding gap on three units is no sale", () => {
    const wrapper = mountComponent(CartItem, {
      props: {
        item: {
          ...mockItem,
          quantity: 3,
          totalPrice: {
            ...mockItem.totalPrice,
            isDiscounted: true,
            sellingPriceExVat: 260.22,
            regularPriceExVat: 260.2251,
            regularPriceIncVatFormatted: '325,28 kr',
          },
        },
      },
      global: {
        stubs: {
          GeinsImage: true,
          QuantityInput: {
            template: '<div />',
            props: ['modelValue', 'min', 'max'],
          },
        },
      },
    });

    expect(
      wrapper.find('[data-testid="cart-item-regular-price"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="cart-item-total-price"]').classes(),
    ).not.toContain('text-destructive');
  });

  describe('campaign badges', () => {
    const stubs = {
      GeinsImage: true,
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

    it('says it is a configured product where an ordinary line names its variant, after the article number', () => {
      const wrapper = mountLine({
        ...configuredItem,
        skuId: 100,
        product: {
          ...mockItem.product,
          skus: [{ skuId: 100, name: 'Standard' }],
        },
      } as unknown as CartItemType);

      const article = wrapper.find('[data-testid="cart-item-article"]');
      expect(article.text().replace(/\s+/g, ' ')).toBe(
        'product.article_number(ART-001) • cart.configured_product',
      );
      expect(article.find('[data-testid="cart-item-configured"]').text()).toBe(
        'cart.configured_product',
      );
    });

    it('says it is a configured product without an article number too', () => {
      const wrapper = mountLine({
        ...configuredItem,
        product: { ...mockItem.product, articleNumber: '' },
      });

      expect(
        wrapper
          .find('[data-testid="cart-item-article"]')
          .text()
          .replace(/\s+/g, ' '),
      ).toBe('cart.configured_product');
    });

    it('links the name to the configurator with the line, the same target as "Ändra konfiguration"', async () => {
      const cart = useCartStore();
      cart.cartId = 'cart-1';
      cart.isOpen = true;
      const wrapper = mountLine(configuredItem);

      const name = wrapper.find('[data-testid="cart-item-name"]');
      expect(name.text()).toBe('Test Product');
      expect(name.element.tagName).toBe('A');
      expect(name.attributes('href')).toBe(
        '/se/en/p/test-product?cart=cart-1&line=item-1',
      );
      expect(name.attributes('href')).toBe(
        wrapper.find('[data-testid="cart-item-edit"]').attributes('href'),
      );

      await name.trigger('click');
      expect(cart.isOpen).toBe(false);
    });

    it('names the product without a link when the line cannot be reopened', () => {
      useCartStore().cartId = null;
      const wrapper = mountLine(configuredItem);

      const name = wrapper.find('[data-testid="cart-item-name"]');
      expect(name.text()).toBe('Test Product');
      expect(name.element.tagName).not.toBe('A');
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

    it('shows its unit price under the total, as every line does', () => {
      const wrapper = mountLine(configuredItem);

      expect(wrapper.find('[data-testid="cart-item-total-price"]').text()).toBe(
        '200 kr',
      );
      expect(wrapper.find('[data-testid="cart-item-unit-price"]').text()).toBe(
        'cart.per_unit(100 kr)',
      );
    });

    it('leaves an ordinary line as it was', () => {
      const wrapper = mountLine(mockItem);

      expect(
        wrapper.find('[data-testid="cart-item-configured"]').exists(),
      ).toBe(false);
      expect(showOf(wrapper).exists()).toBe(false);
      expect(actionsOf(wrapper).exists()).toBe(false);
      expect(wrapper.text()).toContain('product.article_number(ART-001)');
      expect(wrapper.find('a').exists()).toBe(true);
      expect(
        wrapper.find('[data-testid="cart-item-unit-price"]').exists(),
      ).toBe(true);
    });
  });

  describe('while its quantity changes', () => {
    const stubs = {
      GeinsImage: true,
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
      for (const id of ['cart-item-edit', 'cart-item-name']) {
        const link = wrapper.find(`[data-testid="${id}"]`);
        expect(link.attributes('aria-disabled'), id).toBe('true');
        expect(link.attributes('tabindex'), id).toBe('-1');
        expect(link.classes(), id).toContain('pointer-events-none');
      }
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
      QuantityInput: {
        template: '<div data-testid="quantity-stub" />',
        props: ['modelValue', 'min', 'max', 'disabled'],
      },
    };

    /** Both VAT variants, as the cart sends them. */
    function price(exVat: number, regularExVat = exVat) {
      const text = (n: number) => `${n.toFixed(2).replace('.', ',')} kr`;
      return {
        sellingPriceExVat: exVat,
        sellingPriceExVatFormatted: text(exVat),
        sellingPriceIncVat: exVat * 1.25,
        sellingPriceIncVatFormatted: text(exVat * 1.25),
        regularPriceExVat: regularExVat,
        regularPriceExVatFormatted: text(regularExVat),
        regularPriceIncVat: regularExVat * 1.25,
        regularPriceIncVatFormatted: text(regularExVat * 1.25),
        isDiscounted: regularExVat > exVat,
        discountPercentage: Math.round((1 - exVat / regularExVat) * 100),
        currency: { code: 'SEK', symbol: 'kr' },
      };
    }

    const plainItem = {
      ...mockItem,
      unitPrice: price(100),
      totalPrice: price(200),
    } as CartItemType;
    const saleItem = {
      ...mockItem,
      unitPrice: price(2490, 2990),
      totalPrice: price(4980, 5980),
    } as CartItemType;
    const configuredItem = {
      ...plainItem,
      configuration: { configurationId: 'committed-1', summary: [] },
    } as CartItemType;

    beforeEach(() => {
      useCartStore().cartId = 'cart-1';
      mockShowIncVat.value = false;
    });
    afterEach(() => {
      mockShowIncVat.value = true;
    });

    function mountLine(item: CartItemType = plainItem) {
      return mountComponent(CartItem, { props: { item }, global: { stubs } });
    }
    const byId = (wrapper: ReturnType<typeof mountLine>, id: string) =>
      wrapper.find(`[data-testid="${id}"]`);

    it('shows the image at 48 px without a border, and asks for it at 48 px', () => {
      const wrapper = mountLine();

      const image = byId(wrapper, 'cart-item-image');
      expect(image.classes()).toEqual(
        expect.arrayContaining(['size-12', 'rounded-md']),
      );
      expect(image.classes()).not.toContain('border');
      expect(image.classes()).not.toContain('size-20');
      expect(byId(wrapper, 'geins-image').attributes('data-sizes')).toBe(
        '48px',
      );
    });

    it('keeps the placeholder at 48 px on a line without an image', () => {
      const wrapper = mountLine({
        ...plainItem,
        product: { ...mockItem.product, productImages: [] },
      });

      expect(byId(wrapper, 'cart-item-image').classes()).toContain('size-12');
      expect(byId(wrapper, 'geins-image').exists()).toBe(false);
      expect(
        byId(wrapper, 'cart-item-image').findComponent(ImageOff).classes(),
      ).toContain('size-5');
    });

    it('leaves the divider to the list it sits in, 16 px from the content', () => {
      const line = byId(mountLine(), 'cart-item');

      expect(line.classes()).toContain('py-4');
      expect(line.classes()).not.toContain('border-b');
    });

    it.each([
      ['an ordinary line', plainItem, ['cart-item-name', 'cart-item-remove']],
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
      'puts everything on %s but the image in one column beside it, 8 px between its rows',
      (_case, item, inside) => {
        const wrapper = mountLine(item);

        const info = byId(wrapper, 'cart-item-info');
        expect(info.classes()).toContain('space-y-2');
        for (const id of [
          ...inside,
          'quantity-stub',
          'cart-item-total-price',
          'cart-item-unit-price',
        ]) {
          expect(info.find(`[data-testid="${id}"]`).exists(), id).toBe(true);
        }
        const image = byId(wrapper, 'cart-item-image');
        expect(info.element.contains(image.element)).toBe(false);
        expect(image.element.parentElement).toBe(info.element.parentElement);
        expect(image.element.parentElement?.classList).toContain('gap-4');
      },
    );

    it('names the product at 14 px over a 12 px article line, and an ordinary line links to its product', () => {
      const wrapper = mountLine();

      const name = byId(wrapper, 'cart-item-name');
      expect(name.element.tagName).toBe('A');
      expect(name.attributes('href')).toBe('/se/en/p/test-product');
      expect(name.classes()).toEqual(
        expect.arrayContaining(['text-sm', 'font-medium']),
      );
      expect(byId(wrapper, 'cart-item-article').classes()).toContain('text-xs');
    });

    it('puts the quantity on the left and the line price on the right of one row', () => {
      const wrapper = mountLine();

      const row = byId(wrapper, 'cart-item-price-row');
      const [left, right] = row.element.children;
      expect(left?.contains(byId(wrapper, 'quantity-stub').element)).toBe(true);
      expect(right?.isSameNode(byId(wrapper, 'cart-item-price').element)).toBe(
        true,
      );
      expect(byId(wrapper, 'cart-item-price').classes()).toEqual(
        expect.arrayContaining(['shrink-0', 'text-right', 'whitespace-nowrap']),
      );
    });

    it('shows the line total on top at 16 px in tabular figures, and the unit price under it as "/st", with no VAT word', () => {
      const wrapper = mountLine();

      const price = byId(wrapper, 'cart-item-price');
      const [top, bottom] = price.element.children;
      const total = byId(wrapper, 'cart-item-total-price');
      expect(top?.contains(total.element)).toBe(true);
      expect([...(top?.classList ?? [])]).toEqual(
        expect.arrayContaining(['text-base', 'font-semibold', 'tabular-nums']),
      );
      expect(total.text()).toBe('200,00 kr');

      const unit = byId(wrapper, 'cart-item-unit-price');
      expect(bottom?.isSameNode(unit.element)).toBe(true);
      expect(unit.text()).toBe('cart.per_unit(100,00 kr)');
      expect(unit.classes()).toEqual(
        expect.arrayContaining([
          'text-xs',
          'text-muted-foreground',
          'tabular-nums',
          'mt-1',
        ]),
      );

      expect(price.text()).not.toContain('common.vat');
      expect(byId(wrapper, 'cart-item-vat').exists()).toBe(false);
    });

    it('shows the figures including VAT when the buyer chose that', () => {
      mockShowIncVat.value = true;
      const wrapper = mountLine();

      expect(byId(wrapper, 'cart-item-total-price').text()).toBe('250,00 kr');
      expect(byId(wrapper, 'cart-item-unit-price').text()).toBe(
        'cart.per_unit(125,00 kr)',
      );
    });

    it('formats the figure itself when the cart sends no text for the chosen VAT', () => {
      const wrapper = mountLine({
        ...plainItem,
        totalPrice: {
          ...plainItem.totalPrice,
          sellingPriceExVatFormatted: undefined,
        },
      } as CartItemType);

      expect(
        byId(wrapper, 'cart-item-total-price').text().replace(/\s/g, ' '),
      ).toMatch(/200[.,]00/);
    });

    it('strikes the regular total through before a sale total, which is red, with no percent badge', () => {
      const wrapper = mountLine(saleItem);

      const top = byId(wrapper, 'cart-item-price').element.children[0];
      const regular = byId(wrapper, 'cart-item-regular-price');
      const total = byId(wrapper, 'cart-item-total-price');
      expect(top?.firstElementChild?.isSameNode(regular.element)).toBe(true);
      expect(regular.text()).toBe('5980,00 kr');
      expect(regular.classes()).toEqual(
        expect.arrayContaining([
          'line-through',
          'text-xs',
          'text-muted-foreground',
          'font-normal',
          'mr-1.5',
        ]),
      );
      expect(total.text()).toBe('4980,00 kr');
      expect(total.classes()).toContain('text-destructive');
      expect(wrapper.text()).not.toContain('%');
    });

    it('shows the unit price of a sale line as the selling price only', () => {
      const wrapper = mountLine(saleItem);

      const unit = byId(wrapper, 'cart-item-unit-price');
      expect(unit.text()).toBe('cart.per_unit(2490,00 kr)');
      expect(unit.find('.line-through').exists()).toBe(false);
    });

    it('strikes nothing on a line at its regular price', () => {
      const wrapper = mountLine();

      expect(byId(wrapper, 'cart-item-regular-price').exists()).toBe(false);
      expect(byId(wrapper, 'cart-item-total-price').classes()).not.toContain(
        'text-destructive',
      );
    });

    it('shows no price where prices are hidden', () => {
      mockShowPrice.value = false;
      try {
        const wrapper = mountLine();
        expect(byId(wrapper, 'cart-item-price').exists()).toBe(false);
      } finally {
        mockShowPrice.value = true;
      }
    });

    it('starts the quantity row under the image, as tall as it is', () => {
      const wrapper = mountLine();

      const nameRow = byId(wrapper, 'cart-item-remove').element.parentElement;
      expect(nameRow?.classList).toContain('min-h-12');
      expect(
        nameRow?.nextElementSibling?.isSameNode(
          byId(wrapper, 'cart-item-price-row').element,
        ),
      ).toBe(true);
    });

    it('keeps the trash button in the corner without pulling it out', () => {
      const remove = byId(mountLine(), 'cart-item-remove');

      expect(remove.classes()).not.toContain('-mt-1');
      expect(remove.classes()).not.toContain('-mr-2');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DOMWrapper } from '@vue/test-utils';
import { flushPromises } from '@vue/test-utils';
import { mountComponent } from '../../utils/component';
import { requestedShapes } from '../../utils/image';
import ProductCard from '../../../app/components/shared/ProductCard.vue';

// useTenant and useLocaleMarket mocks are provided by setup-components.ts

const cart = vi.hoisted(() => ({
  addItem: vi.fn<(skuId: number, quantity: number) => Promise<void>>(),
  isLoading: false,
  error: null as string | null,
}));

vi.mock('~/stores/cart', () => ({ useCartStore: () => cart }));

beforeEach(() => {
  cart.addItem.mockReset();
  cart.error = null;
});

vi.mock('~/stores/favorites', () => ({
  useFavoritesStore: () => ({
    isFavorite: vi.fn(() => false),
    toggle: vi.fn(),
  }),
}));

const stubs = {
  GeinsImage: {
    props: [
      'fileName',
      'url',
      'type',
      'alt',
      'sizes',
      'widths',
      'loading',
      'priority',
    ],
    template:
      '<img data-testid="geins-image" :data-file-name="fileName" :data-url="url" :data-sizes="sizes" :data-widths="widths?.join(\',\')" :data-loading="loading" :data-priority="String(priority)" :alt="alt" />',
  },
  QuantityStepper: {
    name: 'QuantityStepper',
    props: ['modelValue', 'min', 'max', 'disabled'],
    emits: ['update:modelValue'],
    template:
      '<div data-testid="quantity-stepper" :data-value="modelValue"></div>',
  },
  Button: {
    props: ['disabled', 'variant', 'size'],
    template:
      '<button data-testid="add-to-cart-button" :data-variant="variant" :disabled="disabled"><slot /></button>',
  },
};

const baseProduct = {
  name: 'Test Widget',
  imageFileName: 'widget.jpg',
  price: 199,
  articleNumber: 'ART-001',
  alias: 'test-widget',
};

describe('ProductCard', () => {
  it('renders the product name', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: baseProduct },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Test Widget');
  });

  it('renders article number when provided', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: baseProduct },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="article-number"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="article-number"]').text()).toContain(
      'ART-001',
    );
  });

  it('does not render article number section when absent', () => {
    const wrapper = mountComponent(ProductCard, {
      props: {
        product: { ...baseProduct, articleNumber: undefined },
      },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="article-number"]').exists()).toBe(false);
  });

  it('renders GeinsImage when imageFileName is provided', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: baseProduct },
      global: { stubs },
    });
    const img = wrapper.find('[data-testid="geins-image"]');
    expect(img.exists()).toBe(true);
    expect(img.attributes('data-file-name')).toBe('widget.jpg');
  });

  it('passes the card item’s library url with its file name', () => {
    const wrapper = mountComponent(ProductCard, {
      props: {
        product: {
          ...baseProduct,
          imageUrl: 'https://cdn.example.test/acme/products/widget.jpg',
        },
      },
      global: { stubs },
    });
    const img = wrapper.find('[data-testid="geins-image"]');

    expect(img.attributes('data-file-name')).toBe('widget.jpg');
    expect(img.attributes('data-url')).toBe(
      'https://cdn.example.test/acme/products/widget.jpg',
    );
  });

  it('asks for a thumbnail in the list variant', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: baseProduct, variant: 'list' },
      global: { stubs },
    });
    const img = wrapper.find('[data-testid="geins-image"]');

    expect(img.attributes('data-sizes')).toBe('64px');
    expect(img.attributes('data-widths')).toBe('80,160,240');
  });

  describe('the place in the grid', () => {
    function imageAt(
      index: number | undefined,
      variant: 'grid' | 'list' = 'grid',
    ) {
      return mountComponent(ProductCard, {
        props: { product: baseProduct, index, variant },
        global: { stubs },
      }).find('[data-testid="geins-image"]');
    }

    it('gives the first card the page’s priority', () => {
      expect(imageAt(0).attributes('data-priority')).toBe('true');
    });

    it.each([1, 2, 3])('loads card %i eagerly, without priority', (index) => {
      const img = imageAt(index);

      expect(img.attributes('data-loading')).toBe('eager');
      expect(img.attributes('data-priority')).toBe('false');
    });

    it.each([4, 10, undefined])('leaves card %s to load lazily', (index) => {
      const img = imageAt(index);

      expect(img.attributes('data-loading')).toBe('lazy');
      expect(img.attributes('data-priority')).toBe('false');
    });

    it('never prioritises a thumbnail in the list variant', () => {
      const img = imageAt(0, 'list');

      expect(img.attributes('data-loading')).toBe('lazy');
      expect(img.attributes('data-priority')).not.toBe('true');
    });
  });

  it('renders image fallback when imageFileName is absent', () => {
    const wrapper = mountComponent(ProductCard, {
      props: {
        product: { ...baseProduct, imageFileName: undefined },
      },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="geins-image"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="image-fallback"]').exists()).toBe(true);
  });

  it('renders price', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: baseProduct },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="price"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="price"]').text()).toContain('199');
  });

  it('renders sale price in red and original crossed out when salePrice provided', () => {
    const wrapper = mountComponent(ProductCard, {
      props: {
        product: { ...baseProduct, salePrice: 149 },
      },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="sale-price"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="original-price"]').exists()).toBe(true);
  });

  it('renders QuantityStepper', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: baseProduct },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="quantity-stepper"]').exists()).toBe(
      true,
    );
  });
});

// What a narrow card shows: the icons outside the label, which stays `hidden`
// until the card is wide enough. Icons render through the global `Icon` stub.
function iconsWithoutLabel(button: DOMWrapper<Element>) {
  return button
    .findAll('.icon')
    .filter((icon) => icon.element.closest('.hidden') === null)
    .map((icon) => icon.attributes('data-name'));
}

describe('ProductCard add to cart for a card item', () => {
  const variants = ['grid', 'list'] as const;

  it.each(variants)(
    'shows the cart icon without the label in the %s variant',
    (variant) => {
      const wrapper = mountComponent(ProductCard, {
        props: { product: { ...baseProduct, skuId: 42 }, variant },
        global: { stubs },
      });
      const button = wrapper.find('[data-testid="add-to-cart-button"]');

      expect(iconsWithoutLabel(button)).toEqual(['shopping-cart']);
    },
  );

  it.each(variants)(
    'adds the item’s sku with the chosen quantity in the %s variant',
    async (variant) => {
      const wrapper = mountComponent(ProductCard, {
        props: { product: { ...baseProduct, skuId: 42 }, variant },
        global: { stubs },
      });
      await wrapper
        .findComponent({ name: 'QuantityStepper' })
        .vm.$emit('update:modelValue', 3);

      await wrapper.find('[data-testid="add-to-cart-button"]').trigger('click');

      expect(cart.addItem).toHaveBeenCalledExactlyOnceWith(42, 3);
    },
  );

  it.each([
    [
      'the cart reports an error',
      () =>
        cart.addItem.mockImplementation(async () => {
          cart.error = 'Failed to add item';
        }),
    ],
    ['the add throws', () => cart.addItem.mockRejectedValue(new Error('down'))],
  ])('shows the error icon without the label when %s', async (_, failAdd) => {
    failAdd();
    const wrapper = mountComponent(ProductCard, {
      props: { product: { ...baseProduct, skuId: 42 } },
      global: { stubs },
    });
    const button = wrapper.find('[data-testid="add-to-cart-button"]');

    await button.trigger('click');
    await flushPromises();

    expect(button.attributes('data-variant')).toBe('destructive');
    expect(iconsWithoutLabel(button)).toEqual(['circle-alert']);
  });

  it('keeps the button disabled while the add runs', async () => {
    let finish!: () => void;
    cart.addItem.mockReturnValue(new Promise<void>((r) => (finish = r)));
    const wrapper = mountComponent(ProductCard, {
      props: { product: { ...baseProduct, skuId: 42 } },
      global: { stubs },
    });
    const button = wrapper.find('[data-testid="add-to-cart-button"]');

    await button.trigger('click');
    expect(button.attributes('disabled')).toBeDefined();

    finish();
    await flushPromises();
    expect(button.attributes('disabled')).toBeUndefined();
    expect(button.attributes('data-variant')).toBe('default');
  });

  it('disables the button for an item without a sku', async () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: baseProduct },
      global: { stubs },
    });
    const button = wrapper.find('[data-testid="add-to-cart-button"]');

    expect(button.attributes('disabled')).toBeDefined();
    expect(iconsWithoutLabel(button)).toEqual(['shopping-cart']);
  });
});

describe('ProductCard image box', () => {
  const product = {
    ...baseProduct,
    imageUrl: 'https://cdn.example.test/acme/products/widget.jpg',
  };

  it.each(['grid', 'list'] as const)(
    'asks the CDN for the square its %s box shows',
    (variant) => {
      const wrapper = mountComponent(ProductCard, {
        props: { product, variant },
        global: { stubs: { ...stubs, GeinsImage: false } },
      });
      const img = wrapper.find('img');

      const shapes = requestedShapes(img.attributes('srcset'));
      expect(shapes.length).toBeGreaterThan(0);
      expect(shapes.every((s) => s.ratio === 1 && s.fit === 'crop')).toBe(true);
      expect(img.element.parentElement!.style.aspectRatio).toBe('1 / 1');
      expect(img.element.closest('.aspect-square')).not.toBeNull();
    },
  );
});

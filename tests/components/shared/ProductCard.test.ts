import { describe, it, expect, vi } from 'vitest';
import { mountComponent } from '../../utils/component';
import ProductCard from '../../../app/components/shared/ProductCard.vue';

// useTenant and useLocaleMarket mocks are provided by setup-components.ts

vi.mock('~/stores/cart', () => ({
  useCartStore: () => ({
    addItem: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

vi.mock('~/stores/favorites', () => ({
  useFavoritesStore: () => ({
    isFavorite: vi.fn(() => false),
    toggle: vi.fn(),
  }),
}));

vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canAccess: vi.fn(() => true) }),
}));

const stubs = {
  GeinsImage: {
    props: ['fileName', 'type', 'alt'],
    template:
      '<img data-testid="geins-image" :data-file-name="fileName" :alt="alt" />',
  },
  QuantityStepper: {
    props: ['modelValue', 'min', 'max', 'disabled'],
    emits: ['update:modelValue'],
    template:
      '<div data-testid="quantity-stepper" :data-value="modelValue"></div>',
  },
  Button: {
    props: ['disabled', 'variant', 'size'],
    template:
      '<button data-testid="add-to-cart-button" :disabled="disabled"><slot /></button>',
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

  it('emits add-to-cart with quantity when add button is clicked', async () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: baseProduct },
      global: { stubs },
    });
    await wrapper.find('[data-testid="add-to-cart-button"]').trigger('click');
    const emitted = wrapper.emitted('add-to-cart');
    expect(emitted).toBeTruthy();
    expect(emitted?.[0]?.[0]).toMatchObject({ quantity: 1 });
  });

  it('disables the add-to-cart button when isLoading is true', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: baseProduct, isLoading: true },
      global: { stubs },
    });
    const button = wrapper.find('[data-testid="add-to-cart-button"]');
    expect(button.attributes('disabled')).toBeDefined();
  });
});

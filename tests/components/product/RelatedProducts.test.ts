import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import RelatedProducts from '../../../app/components/product/RelatedProducts.vue';
import { makeListProduct } from '../../fixtures/product';

const productCardStub = {
  template: '<div class="product-card" />',
  props: ['product'],
};

const iconStub = {
  template: '<span class="icon" :data-name="name" />',
  props: ['name'],
};

const stubs = {
  ProductCard: productCardStub,
  SharedProductCard: productCardStub,
  Icon: iconStub,
  NuxtIcon: iconStub,
};

describe('RelatedProducts', () => {
  it('renders nothing when empty array', () => {
    const wrapper = mountComponent(RelatedProducts, {
      props: { products: [] },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="related-products"]').exists()).toBe(
      false,
    );
  });

  it('renders section heading', () => {
    const wrapper = mountComponent(RelatedProducts, {
      props: {
        products: [
          makeListProduct({ productId: 1 }),
          makeListProduct({ productId: 2 }),
        ],
      },
      global: { stubs },
    });
    expect(wrapper.find('h2').text()).toBe('product.related');
  });

  it('renders product cards for each product', () => {
    const wrapper = mountComponent(RelatedProducts, {
      props: {
        products: [
          makeListProduct({ productId: 1 }),
          makeListProduct({ productId: 2 }),
          makeListProduct({ productId: 3 }),
        ],
      },
      global: { stubs },
    });
    const cards = wrapper.findAll('.product-card');
    expect(cards.length).toBe(3);
  });
});

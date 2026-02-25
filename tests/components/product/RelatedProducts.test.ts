import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import RelatedProducts from '../../../app/components/product/RelatedProducts.vue';

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

function makeListProduct(id: number) {
  return {
    productId: id,
    name: `Product ${id}`,
    alias: `product-${id}`,
    canonicalUrl: `/products/product-${id}`,
    articleNumber: `ART-${id}`,
    brand: { name: 'Brand' },
    primaryCategory: { name: 'Category' },
    unitPrice: {
      sellingPriceIncVat: 100,
      sellingPriceIncVatFormatted: '100 kr',
      isDiscounted: false,
    },
    productImages: [{ fileName: `product-${id}.jpg` }],
    totalStock: { inStock: 10, oversellable: 0, totalStock: 10, static: 0 },
    skus: [],
    discountCampaigns: [],
  };
}

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
      props: { products: [makeListProduct(1), makeListProduct(2)] },
      global: { stubs },
    });
    expect(wrapper.find('h2').text()).toBe('product.related');
  });

  it('renders product cards for each product', () => {
    const wrapper = mountComponent(RelatedProducts, {
      props: {
        products: [makeListProduct(1), makeListProduct(2), makeListProduct(3)],
      },
      global: { stubs },
    });
    const cards = wrapper.findAll('.product-card');
    expect(cards.length).toBe(3);
  });
});

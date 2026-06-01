import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import ProductTabs from '../../../app/components/product/ProductTabs.vue';

const stubs = {
  Tabs: {
    template:
      '<div class="tabs" data-testid="tabs" :data-default-value="defaultValue"><slot /></div>',
    props: ['defaultValue'],
  },
  TabsList: {
    template: '<div class="tabs-list" data-testid="tabs-list"><slot /></div>',
  },
  TabsTrigger: {
    template:
      '<button class="tabs-trigger" :data-value="value"><slot /></button>',
    props: ['value'],
  },
  TabsContent: {
    template: '<div class="tabs-content" :data-value="value"><slot /></div>',
    props: ['value'],
  },
  Accordion: {
    template: '<div class="accordion"><slot /></div>',
    props: ['type'],
  },
  AccordionItem: {
    template: '<div class="accordion-item"><slot /></div>',
    props: ['value'],
  },
  AccordionTrigger: {
    template: '<button class="accordion-trigger"><slot /></button>',
  },
  AccordionContent: {
    template: '<div class="accordion-content"><slot /></div>',
  },
  RelatedProducts: {
    template: '<div class="related-products" />',
    props: ['products', 'hideHeading'],
  },
};

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    productId: 1,
    name: 'Test Product',
    alias: 'test-product',
    weight: 500,
    categoryId: 1,
    supplierId: 1,
    texts: { text1: '<p>Product description here</p>' },
    parameterGroups: [
      {
        name: 'Dimensions',
        parameterGroupId: 1,
        parameters: [
          {
            name: 'Weight',
            value: '500g',
            show: true,
            identifier: 'weight',
          },
          {
            name: 'Height',
            value: '10cm',
            show: true,
            identifier: 'height',
          },
          {
            name: 'Produkttyp',
            value: 'Elektronik',
            show: false,
            identifier: 'produkttyp',
          },
          {
            name: '',
            value: null,
            show: true,
            identifier: 'empty',
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('ProductTabs', () => {
  it('renders details, specifications, documents triggers (no reviews)', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: { product: makeProduct(), related: [] },
      global: { stubs },
    });
    const triggers = wrapper.findAll('.tabs-trigger');
    expect(triggers.length).toBe(3);
    const labels = triggers.map((t) => t.text());
    expect(labels).toEqual([
      'product.details',
      'product.specifications',
      'product.documents',
    ]);
    expect(labels).not.toContain('product.reviews');
  });

  it('adds related tab when related products exist', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct(),
        related: [{ productId: 2, name: 'Other' }],
      },
      global: { stubs },
    });
    const triggers = wrapper.findAll('.tabs-trigger');
    expect(triggers.length).toBe(4);
    expect(triggers[3]!.text()).toBe('product.related');
  });

  it('omits related tab when related list is empty or missing', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: { product: makeProduct(), related: null },
      global: { stubs },
    });
    const labels = wrapper.findAll('.tabs-trigger').map((t) => t.text());
    expect(labels).not.toContain('product.related');
  });

  it('renders description content with v-html', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: { product: makeProduct(), related: [] },
      global: { stubs },
    });
    const descContent = wrapper.find('.tabs-content[data-value="description"]');
    expect(descContent.html()).toContain('Product description here');
  });

  it('renders specification table with group name and visible params', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: { product: makeProduct(), related: [] },
      global: { stubs },
    });
    const specContent = wrapper.find(
      '.tabs-content[data-value="specifications"]',
    );
    expect(specContent.text()).toContain('Dimensions');
    expect(specContent.text()).toContain('Weight');
    expect(specContent.text()).toContain('500g');
    expect(specContent.text()).toContain('Produkttyp');
    expect(specContent.text()).toContain('Elektronik');
    expect(specContent.text()).not.toContain('empty');
  });

  it('hides description tab when no text', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: { product: makeProduct({ texts: undefined }), related: [] },
      global: { stubs },
    });
    const labels = wrapper.findAll('.tabs-trigger').map((t) => t.text());
    expect(labels).not.toContain('product.details');
  });

  it('defaults to specifications when product has no description', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: { product: makeProduct({ texts: undefined }), related: [] },
      global: { stubs },
    });
    const tabs = wrapper.find('[data-testid="tabs"]');
    expect(tabs.attributes('data-default-value')).toBe('specifications');
  });

  it('hides the Monitor parameter group from specifications', () => {
    const product = makeProduct({
      parameterGroups: [
        {
          name: 'Monitor',
          parameterGroupId: 99,
          parameters: [
            { name: 'StandardUnit-Code', value: 'm', show: true },
            { name: 'CategoryString', value: 'KB', show: true },
          ],
        },
        {
          name: 'Kabelinfo',
          parameterGroupId: 2,
          parameters: [{ name: 'Ledarantal', value: '1', show: true }],
        },
      ],
    });
    const wrapper = mountComponent(ProductTabs, {
      props: { product, related: [] },
      global: { stubs },
    });
    const specContent = wrapper.find(
      '.tabs-content[data-value="specifications"]',
    );
    expect(specContent.text()).not.toContain('Monitor');
    expect(specContent.text()).not.toContain('StandardUnit-Code');
    expect(specContent.text()).toContain('Kabelinfo');
    expect(specContent.text()).toContain('Ledarantal');
  });

  it('renders RelatedProducts inside the related tab', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct(),
        related: [{ productId: 2, name: 'Other' }],
      },
      global: { stubs },
    });
    const relatedContent = wrapper.find('.tabs-content[data-value="related"]');
    expect(relatedContent.exists()).toBe(true);
    expect(relatedContent.find('.related-products').exists()).toBe(true);
  });
});

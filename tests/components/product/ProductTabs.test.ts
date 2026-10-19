import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import ProductTabs from '../../../app/components/product/ProductTabs.vue';
import { makeListProduct } from '../../fixtures/product';

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
        related: [makeListProduct({ productId: 2, name: 'Other' })],
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

  it('renders both admin Text 2 and Text 3 copy, Text 2 first', () => {
    // Geins offset: API text1 = admin "Text 2", text2 = admin "Text 3",
    // text3 = admin "Text 1" (the last is not part of the details tab).
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct({
          texts: {
            text1: '<p>Admin Text 2 copy</p>',
            text2: '<p>Admin Text 3 copy</p>',
            text3: '<p>Admin Text 1 copy</p>',
          },
        }),
        related: [],
      },
      global: { stubs },
    });
    const html = wrapper.find('.tabs-content[data-value="description"]').html();
    expect(html).toContain('Admin Text 2 copy');
    expect(html).toContain('Admin Text 3 copy');
    expect(html).not.toContain('Admin Text 1 copy');
    expect(html.indexOf('Admin Text 2 copy')).toBeLessThan(
      html.indexOf('Admin Text 3 copy'),
    );
  });

  it('shows the details tab when only admin Text 3 (API text2) has copy', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct({ texts: { text2: '<p>Only Text 3</p>' } }),
        related: [],
      },
      global: { stubs },
    });
    const labels = wrapper.findAll('.tabs-trigger').map((t) => t.text());
    expect(labels).toContain('product.details');
    const content = wrapper.find('.tabs-content[data-value="description"]');
    expect(content.html()).toContain('Only Text 3');
  });

  it('hides the details tab when text fields are only empty markup', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct({ texts: { text1: '<p><br></p>', text2: '   ' } }),
        related: [],
      },
      global: { stubs },
    });
    const labels = wrapper.findAll('.tabs-trigger').map((t) => t.text());
    expect(labels).not.toContain('product.details');
  });

  it('caps the details copy column at max-w-3xl (768px)', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: { product: makeProduct(), related: [] },
      global: { stubs },
    });
    const content = wrapper.find('.tabs-content[data-value="description"]');
    expect(content.html()).toContain('max-w-3xl');
  });

  it('renders only show:true parameters in the specification table', () => {
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
        related: [makeListProduct({ productId: 2, name: 'Other' })],
      },
      global: { stubs },
    });
    const relatedContent = wrapper.find('.tabs-content[data-value="related"]');
    expect(relatedContent.exists()).toBe(true);
    expect(relatedContent.find('.related-products').exists()).toBe(true);
  });
});

describe('ProductTabs localized parameter labels', () => {
  it('prefers the label over the name when both are present', () => {
    // Both are per-language fields in the Geins admin; `label` is
    // the merchant's display name, resolved against the requested language.
    // Showing `name` gives every non-default locale the English key.
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct({
          parameterGroups: [
            {
              name: 'Mått',
              parameterGroupId: 1,
              parameters: [
                {
                  name: 'Weight',
                  label: 'Vikt',
                  value: '500 g',
                  show: true,
                },
              ],
            },
          ],
        }),
        related: [],
      },
      global: { stubs },
    });

    const text = wrapper.text();
    expect(text).toContain('Vikt');
    expect(text).not.toContain('Weight');
  });

  it('falls back to the name when a parameter carries no label', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct({
          parameterGroups: [
            {
              name: 'Mått',
              parameterGroupId: 1,
              parameters: [{ name: 'Weight', value: '500 g', show: true }],
            },
          ],
        }),
        related: [],
      },
      global: { stubs },
    });

    expect(wrapper.text()).toContain('Weight');
  });

  it('falls back to the name in both the desktop and mobile tables', () => {
    // Both panels render the same rows, so a bare wrapper.text() assertion
    // passes when only one of them is right. Each table is checked on its own.
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct({
          parameterGroups: [
            {
              name: 'Mått',
              parameterGroupId: 1,
              parameters: [
                { name: 'Weight', label: '', value: '500 g', show: true },
              ],
            },
          ],
        }),
        related: [],
      },
      global: { stubs },
    });

    const tables = wrapper.findAll('[data-testid="spec-table"]');
    expect(tables.length).toBeGreaterThanOrEqual(2);
    for (const table of tables) {
      expect(table.text()).toContain('Weight');
    }
  });

  it('falls back to the name when the label is an empty string', () => {
    // How an unfilled Label actually arrives from Geins — "" rather than a
    // missing key, which is most parameters on most tenants. Omitting the key
    // (the test above) passes under `??` as well, so it never caught this.
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct({
          parameterGroups: [
            {
              name: 'Mått',
              parameterGroupId: 1,
              parameters: [
                { name: 'Weight', label: '', value: '500 g', show: true },
              ],
            },
          ],
        }),
        related: [],
      },
      global: { stubs },
    });

    expect(wrapper.text()).toContain('Weight');
  });
  describe('documents', () => {
    const assets = [
      {
        id: 'img',
        name: 'photo.jpg',
        url: 'https://cdn.example.com/photo.jpg',
        linkType: 'productimage',
        sizeBytes: 1000,
        description: [],
      },
      {
        id: 'pdf',
        name: 'sheet.pdf',
        url: 'https://cdn.example.com/sheet.pdf',
        linkType: 'productfile',
        sizeBytes: 37862,
        description: [{ language: 'en', value: 'Data sheet' }],
      },
      {
        id: 'zip',
        name: 'pack.zip',
        url: 'https://cdn.example.com/pack.zip',
        linkType: 'productfile',
        sizeBytes: 31897,
        description: [],
      },
    ];

    function documentsTrigger(wrapper: ReturnType<typeof mountComponent>) {
      return wrapper.find('.tabs-trigger[data-value="documents"]');
    }

    it('counts the files on the tab and lists them in tab and accordion', () => {
      const wrapper = mountComponent(ProductTabs, {
        props: { product: makeProduct({ assets }), related: [] },
        global: { stubs },
      });

      expect(documentsTrigger(wrapper).text()).toBe('product.documents (2)');
      // Once in the desktop tab, once in the mobile accordion.
      expect(wrapper.findAll('[data-testid="product-documents"]')).toHaveLength(
        2,
      );
      expect(wrapper.findAll('[data-testid="product-document"]')).toHaveLength(
        4,
      );
      expect(wrapper.text()).not.toContain('product.no_documents');
    });

    it('shows no count and the empty line in both places without files', () => {
      const wrapper = mountComponent(ProductTabs, {
        props: {
          product: makeProduct({ assets: assets.slice(0, 1) }),
          related: [],
        },
        global: { stubs },
      });

      expect(documentsTrigger(wrapper).text()).toBe('product.documents');
      expect(wrapper.find('[data-testid="product-documents"]').exists()).toBe(
        false,
      );
      expect(wrapper.text().split('product.no_documents')).toHaveLength(3);
    });
  });
});

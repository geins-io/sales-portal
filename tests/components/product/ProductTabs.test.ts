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
    // Documents is conditional, so the product needs a media parameter for
    // all three triggers to be in play.
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct({
          parameterGroups: [
            ...makeProduct().parameterGroups,
            {
              name: 'Dokumentation',
              parameterGroupId: 46,
              parameters: [
                {
                  name: 'Manual',
                  label: 'Manual',
                  value: 'https://cdn.example.com/manual.pdf',
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
        product: makeProduct({
          parameterGroups: [
            ...makeProduct().parameterGroups,
            {
              name: 'Dokumentation',
              parameterGroupId: 46,
              parameters: [
                {
                  name: 'Manual',
                  label: 'Manual',
                  value: 'https://cdn.example.com/manual.pdf',
                  show: true,
                },
              ],
            },
          ],
        }),
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
    // `show: false` is the merchant saying "don't display this on the
    // storefront" — Produkttyp/Elektronik carry it and must stay hidden.
    expect(specContent.text()).not.toContain('Produkttyp');
    expect(specContent.text()).not.toContain('Elektronik');
    // Nameless/valueless rows are dropped regardless of `show`.
    expect(specContent.text()).not.toContain('empty');
  });

  // Length/width/height/weight live on the product record itself, not as
  // parameters (verified against Geins 2026-09-13: ProductType exposes
  // `dimensions` and `weight` alongside `parameterGroups`). They still belong
  // in the spec table, so they are appended as a synthetic group. Geins stores
  // dimensions in millimetres and weight in grams.
  const MEASURED = {
    dimensions: { length: 3000, width: 120, height: 45 },
    weight: 500,
  };

  it('does not repeat a measurement the PIM already lists as a parameter', () => {
    // The base fixture carries both a `Weight` parameter (identifier
    // "weight", value "500g") and product.weight = 500. Rendering both puts
    // "500g" and "500 g" in the same table as separate rows.
    const wrapper = mountComponent(ProductTabs, {
      props: { product: makeProduct(MEASURED), related: [] },
      global: { stubs },
    });

    const text = wrapper
      .find('.tabs-content[data-value="specifications"]')
      .text();
    // The PIM row wins; the product-level duplicate is not appended.
    expect(text).toContain('500g');
    expect(text).not.toContain('500 g');
    expect(text).toContain('10cm');
    expect(text).not.toContain('45 mm');
    // Dimensions the PIM does not carry still come from the product record.
    expect(text).toContain('3 m');
    expect(text).toContain('120 mm');
  });

  it('shows product-level measurements in the specification table', () => {
    // No parameter groups, so nothing competes with the product-level values
    // — the dedup case has its own test above.
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct({ ...MEASURED, parameterGroups: [] }),
        related: [],
      },
      global: { stubs },
    });
    const text = wrapper
      .find('.tabs-content[data-value="specifications"]')
      .text();
    expect(text).toContain('product.measurements');
    expect(text).toContain('3 m');
    expect(text).toContain('120 mm');
    expect(text).toContain('45 mm');
    expect(text).toContain('500 g');
  });

  it('omits measurements that are zero rather than printing "0 mm"', () => {
    // Real data: A2K-TDC-3M has length 3000 but width/height/weight 0.
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct({
          dimensions: { length: 3000, width: 0, height: 0 },
          weight: 0,
        }),
        related: [],
      },
      global: { stubs },
    });
    const text = wrapper
      .find('.tabs-content[data-value="specifications"]')
      .text();
    expect(text).toContain('3 m');
    // "3000 mm" contains the substring "0 mm", so assert on the rows that
    // should be absent instead of on a substring of one that is present.
    expect(text).not.toContain('product.width');
    expect(text).not.toContain('product.height');
    expect(text).not.toContain('product.weight');
  });

  it('omits the measurements group when the product has none', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct({
          dimensions: { length: 0, width: 0, height: 0 },
          weight: 0,
        }),
        related: [],
      },
      global: { stubs },
    });
    const text = wrapper
      .find('.tabs-content[data-value="specifications"]')
      .text();
    expect(text).not.toContain('product.measurements');
  });

  it('shows measurements in the mobile accordion too', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: { product: makeProduct(MEASURED), related: [] },
      global: { stubs },
    });
    expect(wrapper.find('.accordion').text()).toContain('3 m');
  });

  it('shows the specifications tab for a product with only measurements', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct({ ...MEASURED, parameterGroups: [] }),
        related: [],
      },
      global: { stubs },
    });
    const labels = wrapper.findAll('.tabs-trigger').map((x) => x.text());
    expect(labels).toContain('product.specifications');
  });

  // A tab with nothing in it is noise. Description, specifications and
  // related were already conditional; documents was not, so every product
  // without media rendered a Documents tab whose only content was "no
  // documents available".
  const NO_CONTENT = {
    texts: undefined,
    parameterGroups: [],
    weight: 0,
    dimensions: { length: 0, width: 0, height: 0 },
  };

  it('hides the documents tab when the product has no media', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: { product: makeProduct(NO_CONTENT), related: [] },
      global: { stubs },
    });
    const labels = wrapper.findAll('.tabs-trigger').map((x) => x.text());
    expect(labels).not.toContain('product.documents');
    expect(wrapper.text()).not.toContain('product.no_documents');
  });

  it('hides the documents section in the mobile accordion too', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: { product: makeProduct(NO_CONTENT), related: [] },
      global: { stubs },
    });
    // Nothing to show, so the accordion is not rendered at all — which also
    // means no documents section.
    expect(wrapper.find('.accordion').exists()).toBe(false);
  });

  it('still shows the documents tab when the product has media', () => {
    const product = makeProduct({
      ...NO_CONTENT,
      parameterGroups: [
        {
          name: 'Dokumentation',
          parameterGroupId: 46,
          parameters: [
            {
              name: 'Manual',
              label: 'Manual',
              value: 'https://example.com/manual.pdf',
              show: true,
            },
          ],
        },
      ],
    });
    const wrapper = mountComponent(ProductTabs, {
      props: { product, related: [] },
      global: { stubs },
    });
    const labels = wrapper.findAll('.tabs-trigger').map((x) => x.text());
    expect(labels).toContain('product.documents');
  });

  it('still renders the tab strip when the product has exactly one tab', () => {
    // The empty-strip fix must not swallow the single-tab case.
    const wrapper = mountComponent(ProductTabs, {
      props: { product: makeProduct(MEASURED), related: [] },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="tabs"]').exists()).toBe(true);
    expect(wrapper.findAll('.tabs-trigger').length).toBeGreaterThanOrEqual(1);
  });

  it('never defaults to a tab that is not rendered', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: { product: makeProduct(NO_CONTENT), related: [] },
      global: { stubs },
    });
    const tabs = wrapper.find('[data-testid="tabs"]');
    // A product with nothing to show renders no tab control, rather than an
    // empty TabsList whose underline rule is the only thing on the page.
    expect(tabs.exists()).toBe(false);
    expect(wrapper.findAll('.tabs-trigger')).toHaveLength(0);
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

  it('renders a VideoURL parameter as an embedded video, not a spec row', () => {
    const product = makeProduct({
      parameterGroups: [
        {
          name: 'Dokumentation',
          parameterGroupId: 46,
          parameters: [
            {
              name: 'VideoURL',
              label: 'VideoURL',
              value: 'https://www.youtube.com/watch?v=abc123',
              show: true,
            },
          ],
        },
      ],
      // The fixture ships a product-level weight, which is now a spec row in
      // its own right. Cleared here so the assertion below still measures
      // "VideoURL did not become a spec row" and not "the product has a
      // weight".
      weight: 0,
      dimensions: { length: 0, width: 0, height: 0 },
    });
    const wrapper = mountComponent(ProductTabs, {
      props: { product, related: [] },
      global: { stubs },
    });
    const docsContent = wrapper.find('.tabs-content[data-value="documents"]');
    const iframe = docsContent.find('[data-testid="product-videos"] iframe');
    expect(iframe.exists()).toBe(true);
    expect(iframe.attributes('src')).toBe(
      'https://www.youtube.com/embed/abc123',
    );

    const specContent = wrapper.find(
      '.tabs-content[data-value="specifications"]',
    );
    expect(specContent.exists()).toBe(false);
  });

  it('renders Manual and ProductSpec parameters as document links', () => {
    const product = makeProduct({
      parameterGroups: [
        {
          name: 'Dokumentation',
          parameterGroupId: 46,
          parameters: [
            {
              name: 'Manual',
              label: 'Manual',
              value: 'https://cdn.example.com/manual.pdf',
              show: true,
            },
            {
              name: 'ProductSpec',
              label: 'ProductSpec',
              value: 'https://cdn.example.com/spec.pdf',
              show: true,
            },
          ],
        },
      ],
    });
    const wrapper = mountComponent(ProductTabs, {
      props: { product, related: [] },
      global: { stubs },
    });
    const docsContent = wrapper.find('.tabs-content[data-value="documents"]');
    const links = docsContent.findAll('[data-testid="product-documents"] a');
    expect(links.length).toBe(2);
    expect(links[0]!.attributes('href')).toBe(
      'https://cdn.example.com/manual.pdf',
    );
    expect(links[0]!.text()).toContain('Manual');
    expect(links[1]!.text()).toContain('Product Spec');
  });

  it('gives the mobile accordion the same media handling as the desktop tabs', () => {
    // The two views are separate markup; every media fix has to land in
    // both. Tests scoped only to .tabs-content let them drift apart.
    const product = makeProduct({
      parameterGroups: [
        {
          name: 'Dokumentation',
          parameterGroupId: 46,
          parameters: [
            {
              name: 'VideoURL',
              value: 'https://www.loom.com/share/abc123',
              show: true,
            },
          ],
        },
      ],
    });
    const wrapper = mountComponent(ProductTabs, {
      props: { product, related: [] },
      global: { stubs },
    });
    const mobile = wrapper.find('.accordion');
    expect(mobile.exists()).toBe(true);
    // A provider page URL can't play in a <video>; both views must link out.
    expect(mobile.findAll('video').length).toBe(0);
    expect(
      mobile.findAll('a[href="https://www.loom.com/share/abc123"]').length,
    ).toBe(1);
  });

  it('hides a media parameter the merchant marked show:false', () => {
    // `show: false` has to mean the same thing for a video as for a spec
    // row, otherwise hiding a parameter removes it from the table but
    // leaves it playing in the Documents tab.
    const product = makeProduct({
      parameterGroups: [
        {
          name: 'Dokumentation',
          parameterGroupId: 46,
          parameters: [
            {
              name: 'VideoURL',
              value: 'https://www.youtube.com/watch?v=abc123',
              show: false,
            },
            {
              name: 'Manual',
              value: 'https://cdn.example.com/manual.pdf',
              show: false,
            },
          ],
        },
      ],
    });
    const wrapper = mountComponent(ProductTabs, {
      props: { product, related: [] },
      global: { stubs },
    });
    // Both media parameters were hidden, so nothing is left for the tab to
    // show and the tab itself is gone — a stronger guarantee than an empty
    // Documents panel.
    expect(wrapper.find('.tabs-content[data-value="documents"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="product-videos"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="product-documents"]').exists()).toBe(
      false,
    );
  });

  it('prefers the localized label over the technical name in the spec table', () => {
    const product = makeProduct({
      parameterGroups: [
        {
          name: 'Fysiska egenskaper',
          parameterGroupId: 39,
          parameters: [
            {
              name: 'InstallationDiameter',
              label: 'Installationsdiameter',
              value: '25 mm',
              show: true,
            },
          ],
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
    expect(specContent.text()).toContain('Installationsdiameter');
    expect(specContent.text()).not.toContain('InstallationDiameter');
  });

  it('falls back to a normal spec row when a known media name has a non-URL value', () => {
    const product = makeProduct({
      parameterGroups: [
        {
          name: 'Dokumentation',
          parameterGroupId: 46,
          parameters: [
            { name: 'ProductSpec', value: 'See page 4', show: true },
          ],
        },
      ],
    });
    const wrapper = mountComponent(ProductTabs, {
      props: { product, related: [] },
      global: { stubs },
    });
    // Nothing became a document, so the tab should not exist at all.
    expect(wrapper.find('.tabs-content[data-value="documents"]').exists()).toBe(
      false,
    );

    const specContent = wrapper.find(
      '.tabs-content[data-value="specifications"]',
    );
    expect(specContent.text()).toContain('ProductSpec');
    expect(specContent.text()).toContain('See page 4');
  });

  it('hides the documents tab when parameters exist but none are media', () => {
    // The default fixture has spec parameters (Weight, Height) and no media.
    const wrapper = mountComponent(ProductTabs, {
      props: { product: makeProduct(), related: [] },
      global: { stubs },
    });
    expect(wrapper.find('.tabs-content[data-value="documents"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).not.toContain('product.no_documents');
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

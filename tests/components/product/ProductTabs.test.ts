import { describe, it, expect, vi } from 'vitest';
import { mountComponent } from '../../utils/component';
import ProductTabs from '../../../app/components/product/ProductTabs.vue';

// Mock useMediaQuery to control desktop/mobile
vi.mock('@vueuse/core', () => ({
  useMediaQuery: vi.fn().mockReturnValue({ value: true }),
}));

const stubs = {
  // Tabs (desktop)
  Tabs: {
    template: '<div class="tabs" data-testid="tabs"><slot /></div>',
    props: ['defaultValue'],
    emits: ['update:modelValue'],
  },
  UiTabs: {
    template: '<div class="tabs" data-testid="tabs"><slot /></div>',
    props: ['defaultValue'],
  },
  TabsList: {
    template: '<div class="tabs-list" data-testid="tabs-list"><slot /></div>',
  },
  UiTabsList: { template: '<div class="tabs-list"><slot /></div>' },
  TabsTrigger: {
    template:
      '<button class="tabs-trigger" :data-value="value"><slot /></button>',
    props: ['value'],
  },
  UiTabsTrigger: {
    template:
      '<button class="tabs-trigger" :data-value="value"><slot /></button>',
    props: ['value'],
  },
  TabsContent: {
    template: '<div class="tabs-content" :data-value="value"><slot /></div>',
    props: ['value'],
  },
  UiTabsContent: {
    template: '<div class="tabs-content" :data-value="value"><slot /></div>',
    props: ['value'],
  },
  // Accordion (mobile)
  Accordion: {
    template: '<div class="accordion"><slot /></div>',
    props: ['type'],
  },
  UiAccordion: {
    template: '<div class="accordion"><slot /></div>',
    props: ['type'],
  },
  AccordionItem: {
    template: '<div class="accordion-item"><slot /></div>',
    props: ['value'],
  },
  UiAccordionItem: {
    template: '<div class="accordion-item"><slot /></div>',
    props: ['value'],
  },
  AccordionTrigger: {
    template: '<button class="accordion-trigger"><slot /></button>',
  },
  UiAccordionTrigger: {
    template: '<button class="accordion-trigger"><slot /></button>',
  },
  AccordionContent: {
    template: '<div class="accordion-content"><slot /></div>',
  },
  UiAccordionContent: {
    template: '<div class="accordion-content"><slot /></div>',
  },
  // Review card
  ProductReviewCard: {
    template: '<div class="review-card" />',
    props: ['review'],
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
        groupName: 'Dimensions',
        parameters: [
          {
            parameterId: 1,
            parameterGroupId: 1,
            name: 'Weight',
            value: '500g',
            show: true,
            showFilter: false,
          },
          {
            parameterId: 2,
            parameterGroupId: 1,
            name: 'Height',
            value: '10cm',
            show: true,
            showFilter: false,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('ProductTabs', () => {
  it('renders tab triggers for description, specifications, reviews', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct(),
        reviews: null,
        reviewsLoading: false,
      },
      global: { stubs },
    });
    const triggers = wrapper.findAll('.tabs-trigger');
    expect(triggers.length).toBe(3);
    expect(triggers[0]!.text()).toBe('product.description');
    expect(triggers[1]!.text()).toBe('product.specifications');
    expect(triggers[2]!.text()).toBe('product.reviews');
  });

  it('renders description content with v-html', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct(),
        reviews: null,
        reviewsLoading: false,
      },
      global: { stubs },
    });
    const descContent = wrapper.find('.tabs-content[data-value="description"]');
    expect(descContent.html()).toContain('Product description here');
  });

  it('renders specification table', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct(),
        reviews: null,
        reviewsLoading: false,
      },
      global: { stubs },
    });
    const specContent = wrapper.find(
      '.tabs-content[data-value="specifications"]',
    );
    expect(specContent.text()).toContain('Weight');
    expect(specContent.text()).toContain('500g');
  });

  it('hides description tab when no text', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct({ texts: undefined }),
        reviews: null,
        reviewsLoading: false,
      },
      global: { stubs },
    });
    const triggers = wrapper.findAll('.tabs-trigger');
    const labels = triggers.map((t) => t.text());
    expect(labels).not.toContain('product.description');
  });

  it('shows loading state when reviews loading', () => {
    const wrapper = mountComponent(ProductTabs, {
      props: {
        product: makeProduct(),
        reviews: null,
        reviewsLoading: true,
      },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('product.loading_reviews');
  });
});

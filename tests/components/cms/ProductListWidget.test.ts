import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, type ComputedRef } from 'vue';
import { mountComponent } from '../../utils/component';
import ProductListWidget from '../../../app/components/cms/widgets/ProductListWidget.vue';

// Capture the options passed to useFetch so we can assert the query the widget
// builds. The widget resolves its language server-side from request context,
// but the active locale/market must still be part of the query key so the
// fetch (and CDN cache) is keyed per locale. Otherwise a language switch
// reuses the previous locale's cached products (SAL-256).
const calls: Array<Record<string, unknown>> = [];

// Drives the mocked useFetch response so the slideshow branch can render real
// item nodes. The existing regression tests expect an empty list; the
// slideshow tests set this to N ListProduct-shaped items before mounting.
const fetchProducts = ref<Array<{ productId: number }>>([]);

const mockUseFetch = vi.fn((_url: unknown, opts?: Record<string, unknown>) => {
  if (opts) calls.push(opts);
  return {
    data: ref({
      products: fetchProducts.value,
      count: fetchProducts.value.length,
    }),
  };
});

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...(args as [unknown])),
}));
vi.stubGlobal('useFetch', (...args: unknown[]) =>
  mockUseFetch(...(args as [unknown])),
);

// Drive the Embla scroll state deterministically. jsdom has no layout, so the
// real Carousel never computes snaps; mock the whole suite with stubs whose
// slot props (canScrollPrev/canScrollNext) we control per test. Only the
// external carousel module is mocked. ProductCard and the widget itself stay
// real (anti-pattern: never stub internal modules that could hide a regression).
const canScrollPrev = ref(false);
const canScrollNext = ref(false);

vi.mock('@/components/ui/carousel', () => ({
  Carousel: {
    name: 'Carousel',
    props: ['opts', 'plugins', 'orientation'],
    template:
      '<div data-slot="carousel"><slot :can-scroll-prev="canScrollPrev" :can-scroll-next="canScrollNext" /></div>',
    setup() {
      return {
        canScrollPrev: canScrollPrev.value,
        canScrollNext: canScrollNext.value,
      };
    },
  },
  CarouselContent: {
    name: 'CarouselContent',
    template: '<div data-slot="carousel-content"><slot /></div>',
  },
  CarouselItem: {
    name: 'CarouselItem',
    template:
      '<div data-slot="carousel-item" :class="$attrs.class"><slot /></div>',
  },
  CarouselPrevious: {
    name: 'CarouselPrevious',
    props: ['ariaLabel'],
    template:
      '<button data-slot="carousel-previous" :aria-label="ariaLabel"></button>',
  },
  CarouselNext: {
    name: 'CarouselNext',
    props: ['ariaLabel'],
    template:
      '<button data-slot="carousel-next" :aria-label="ariaLabel"></button>',
  },
  CarouselDots: {
    name: 'CarouselDots',
    props: ['label'],
    template: '<div data-slot="carousel-dots" :data-label="label"></div>',
  },
}));

type WidgetData = {
  title?: string;
  pageCount?: number;
  searchParameters?: Record<string, unknown>;
  slideshowDisabled?: boolean;
  displayNavigationArrows?: boolean;
  displayNavigationLinks?: boolean;
};

function makeProps(data: Partial<WidgetData> = {}) {
  return {
    data: {
      title: 'Featured',
      pageCount: 1,
      ...data,
    },
    config: {
      name: 'test',
      displayName: 'Featured',
      active: true,
      type: 'ProductListWidget',
      size: 'full',
      sortOrder: 0,
    },
    layout: 'full',
  };
}

function makeProduct(id: number) {
  return {
    productId: id,
    name: `Product ${id}`,
    alias: `product-${id}`,
    canonicalUrl: `/p/product-${id}`,
    articleNumber: `ART-${id}`,
    brand: { name: 'Brand' },
    primaryCategory: { name: 'Category' },
    unitPrice: {},
    productImages: [],
    totalStock: {},
    skus: [],
    discountCampaigns: [],
  };
}

function resolveQuery(): Record<string, unknown> {
  const query = calls[0]?.query as
    | ComputedRef<Record<string, unknown>>
    | Record<string, unknown>
    | (() => Record<string, unknown>)
    | undefined;
  if (typeof query === 'function') return query();
  if (query && 'value' in query)
    return (query as ComputedRef<Record<string, unknown>>).value;
  return (query as Record<string, unknown>) ?? {};
}

describe('ProductListWidget', () => {
  beforeEach(() => {
    calls.length = 0;
    mockUseFetch.mockClear();
    fetchProducts.value = [];
    canScrollPrev.value = false;
    canScrollNext.value = false;
  });

  // ---------------------------------------------------------------------
  // SAL-256 regression guard. DO NOT remove. The fetch key must carry the
  // active locale/market so a language switch busts the cache.
  // ---------------------------------------------------------------------
  it('keys the product fetch by the active locale and market', () => {
    mountComponent(ProductListWidget, { props: makeProps() });
    const query = resolveQuery();
    // The locale + market from the active route must reach the query so the
    // useFetch key changes on language switch and the CDN cache does not
    // serve a different locale's response.
    expect(query.locale).toBe('en');
    expect(query.market).toBe('se');
    // Existing behaviour preserved.
    expect(query.take).toBe(4);
    expect(query.skip).toBe(0);
  });

  it('still forwards the curated CMS filter alongside the locale', () => {
    const params = { searchText: 'cable' };
    mountComponent(ProductListWidget, {
      props: makeProps({ searchParameters: params }),
    });
    const query = resolveQuery();
    expect(query.filter).toBe(JSON.stringify(params));
    expect(query.locale).toBe('en');
    expect(query.market).toBe('se');
  });

  // ---------------------------------------------------------------------
  // Grid vs slideshow selection: strictly slideshowDisabled === false.
  // ---------------------------------------------------------------------
  it('renders the responsive grid when slideshowDisabled is true', () => {
    fetchProducts.value = [makeProduct(1), makeProduct(2)];
    const wrapper = mountComponent(ProductListWidget, {
      props: makeProps({ slideshowDisabled: true }),
    });
    expect(wrapper.find('.grid.grid-cols-2').exists()).toBe(true);
    expect(wrapper.find('[data-slot="carousel"]').exists()).toBe(false);
  });

  it('renders the responsive grid when slideshowDisabled is undefined', () => {
    fetchProducts.value = [makeProduct(1), makeProduct(2)];
    const wrapper = mountComponent(ProductListWidget, {
      props: makeProps(),
    });
    expect(wrapper.find('.grid.grid-cols-2').exists()).toBe(true);
    expect(wrapper.find('[data-slot="carousel"]').exists()).toBe(false);
  });

  it('renders the slideshow carousel when slideshowDisabled is false', () => {
    fetchProducts.value = [makeProduct(1), makeProduct(2), makeProduct(3)];
    const wrapper = mountComponent(ProductListWidget, {
      props: makeProps({ slideshowDisabled: false }),
    });
    expect(wrapper.find('[data-slot="carousel"]').exists()).toBe(true);
    expect(wrapper.find('[data-slot="carousel-content"]').exists()).toBe(true);
    // The grid container must NOT render in slideshow mode.
    expect(wrapper.find('.grid.grid-cols-2').exists()).toBe(false);
  });

  it('renders one carousel item per product with 4-per-row basis classes', () => {
    fetchProducts.value = [makeProduct(1), makeProduct(2), makeProduct(3)];
    const wrapper = mountComponent(ProductListWidget, {
      props: makeProps({ slideshowDisabled: false }),
    });
    const items = wrapper.findAll('[data-slot="carousel-item"]');
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.classes()).toContain('basis-1/2');
      expect(item.classes()).toContain('md:basis-1/3');
      expect(item.classes()).toContain('lg:basis-1/4');
    }
  });

  // ---------------------------------------------------------------------
  // Arrow gating matrix: toggle AND real multi-page state.
  // ---------------------------------------------------------------------
  it('hides arrows on a single page even when displayNavigationArrows is true', () => {
    fetchProducts.value = [makeProduct(1)];
    canScrollPrev.value = false;
    canScrollNext.value = false;
    const wrapper = mountComponent(ProductListWidget, {
      props: makeProps({
        slideshowDisabled: false,
        displayNavigationArrows: true,
      }),
    });
    expect(wrapper.find('[data-slot="carousel-previous"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-slot="carousel-next"]').exists()).toBe(false);
  });

  it('shows arrows on multiple pages when displayNavigationArrows is true', () => {
    fetchProducts.value = [makeProduct(1), makeProduct(2), makeProduct(3)];
    canScrollPrev.value = false;
    canScrollNext.value = true;
    const wrapper = mountComponent(ProductListWidget, {
      props: makeProps({
        slideshowDisabled: false,
        displayNavigationArrows: true,
      }),
    });
    const prev = wrapper.find('[data-slot="carousel-previous"]');
    const next = wrapper.find('[data-slot="carousel-next"]');
    expect(prev.exists()).toBe(true);
    expect(next.exists()).toBe(true);
    // Arrow aria-labels reuse the existing pagination keys.
    expect(prev.attributes('aria-label')).toBe('pagination.previous');
    expect(next.attributes('aria-label')).toBe('pagination.next');
  });

  it('hides arrows on multiple pages when displayNavigationArrows is false', () => {
    fetchProducts.value = [makeProduct(1), makeProduct(2), makeProduct(3)];
    canScrollPrev.value = false;
    canScrollNext.value = true;
    const wrapper = mountComponent(ProductListWidget, {
      props: makeProps({
        slideshowDisabled: false,
        displayNavigationArrows: false,
      }),
    });
    expect(wrapper.find('[data-slot="carousel-previous"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-slot="carousel-next"]').exists()).toBe(false);
  });

  // ---------------------------------------------------------------------
  // Dot gating matrix: toggle AND real multi-page state.
  // ---------------------------------------------------------------------
  it('hides dots on a single page even when displayNavigationLinks is true', () => {
    fetchProducts.value = [makeProduct(1)];
    canScrollPrev.value = false;
    canScrollNext.value = false;
    const wrapper = mountComponent(ProductListWidget, {
      props: makeProps({
        slideshowDisabled: false,
        displayNavigationLinks: true,
      }),
    });
    expect(wrapper.find('[data-slot="carousel-dots"]').exists()).toBe(false);
  });

  it('shows dots on multiple pages when displayNavigationLinks is true', () => {
    fetchProducts.value = [makeProduct(1), makeProduct(2), makeProduct(3)];
    canScrollPrev.value = true;
    canScrollNext.value = false;
    const wrapper = mountComponent(ProductListWidget, {
      props: makeProps({
        slideshowDisabled: false,
        displayNavigationLinks: true,
      }),
    });
    const dots = wrapper.find('[data-slot="carousel-dots"]');
    expect(dots.exists()).toBe(true);
    // Passes a localized prefix label so the dot sr-only text is translated.
    expect(dots.attributes('data-label')).toBe(
      'product_slideshow.go_to_slide_prefix',
    );
  });

  it('hides dots on multiple pages when displayNavigationLinks is false', () => {
    fetchProducts.value = [makeProduct(1), makeProduct(2), makeProduct(3)];
    canScrollPrev.value = true;
    canScrollNext.value = false;
    const wrapper = mountComponent(ProductListWidget, {
      props: makeProps({
        slideshowDisabled: false,
        displayNavigationLinks: false,
      }),
    });
    expect(wrapper.find('[data-slot="carousel-dots"]').exists()).toBe(false);
  });

  // ---------------------------------------------------------------------
  // Clamp: gating uses the slot props at both ends. loop:false means at the
  // first page only canScrollNext is true, at the last only canScrollPrev.
  // ---------------------------------------------------------------------
  it('shows chrome at the first page (canScrollNext only)', () => {
    fetchProducts.value = [makeProduct(1), makeProduct(2), makeProduct(3)];
    canScrollPrev.value = false;
    canScrollNext.value = true;
    const wrapper = mountComponent(ProductListWidget, {
      props: makeProps({
        slideshowDisabled: false,
        displayNavigationArrows: true,
        displayNavigationLinks: true,
      }),
    });
    expect(wrapper.find('[data-slot="carousel-previous"]').exists()).toBe(true);
    expect(wrapper.find('[data-slot="carousel-next"]').exists()).toBe(true);
    expect(wrapper.find('[data-slot="carousel-dots"]').exists()).toBe(true);
  });

  it('shows chrome at the last page (canScrollPrev only)', () => {
    fetchProducts.value = [makeProduct(1), makeProduct(2), makeProduct(3)];
    canScrollPrev.value = true;
    canScrollNext.value = false;
    const wrapper = mountComponent(ProductListWidget, {
      props: makeProps({
        slideshowDisabled: false,
        displayNavigationArrows: true,
        displayNavigationLinks: true,
      }),
    });
    expect(wrapper.find('[data-slot="carousel-previous"]').exists()).toBe(true);
    expect(wrapper.find('[data-slot="carousel-next"]').exists()).toBe(true);
    expect(wrapper.find('[data-slot="carousel-dots"]').exists()).toBe(true);
  });
});

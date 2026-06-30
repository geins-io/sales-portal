import { describe, it, expect, vi, afterEach } from 'vitest';
import { onMounted, ref } from 'vue';
import { mountComponent } from '../../utils/component';
import JsonWidget from '../../../app/components/cms/widgets/JsonWidget.vue';

// jsdom has no layout, so the real Embla carousel never computes scroll snaps.
// Mock the external carousel module with stubs whose canScrollPrev/Next slot
// props we drive per test; JsonWidget itself stays real. Only the external
// module is mocked (never an internal one that could hide a regression).
const canScrollPrev = ref(false);
const canScrollNext = ref(false);

vi.mock('@/components/ui/carousel', () => ({
  Carousel: {
    name: 'Carousel',
    props: ['opts', 'plugins', 'orientation'],
    emits: ['init-api'],
    template:
      '<div data-slot="carousel" :class="$attrs.class"><slot :can-scroll-prev="canScrollPrev" :can-scroll-next="canScrollNext" /></div>',
    setup(
      _props: unknown,
      { emit }: { emit: (e: string, ...a: unknown[]) => void },
    ) {
      onMounted(() => emit('init-api', { reInit: () => {} }));
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
  CarouselDots: {
    name: 'CarouselDots',
    props: ['label'],
    template: '<div data-slot="carousel-dots"></div>',
  },
}));

// Stub FormWidget so we can detect when it is rendered without full form logic.
const formWidgetStub = {
  template: '<div data-testid="form-widget-stub" />',
  props: ['data', 'config', 'layout'],
};

// Stub the i18n-t component used inside FormWidget (not rendered here but imported).
const i18nTStub = {
  template: '<span><slot name="recipient" /></span>',
  props: ['keypath', 'tag'],
};

const baseConfig = {
  name: 'json-widget',
  displayName: 'JSON Widget',
  active: true,
  type: 'JSONPageWidget',
  size: 'full' as const,
  sortOrder: 0,
};

function mountJson(data: Record<string, unknown>, collapse = false) {
  return mountComponent(JsonWidget, {
    props: { data, config: baseConfig, layout: 'full', collapse },
    global: {
      stubs: {
        FormWidget: formWidgetStub,
        CmsWidgetsFormWidget: formWidgetStub,
        'i18n-t': i18nTStub,
        GeinsImage: { template: '<img data-testid="geins-image" />' },
      },
    },
  });
}

describe('JsonWidget routing', () => {
  // W10: form-shaped data routes to FormWidget.
  it('renders FormWidget when data has sendFormToEmail and fields', () => {
    const wrapper = mountJson({
      sendFormToEmail: 'admin@example.com',
      fields: [
        { label: 'Company', name: 'company', required: true, type: 'input' },
      ],
    });
    expect(wrapper.find('[data-testid="form-widget-stub"]').exists()).toBe(
      true,
    );
  });

  // W10: non-form data (cards template) does NOT render FormWidget.
  it('does NOT render FormWidget for a cards-rich template', () => {
    const wrapper = mountJson({
      templateId: 'cards-rich',
      header: { heading: 'Hello', description: 'World' },
      items: [],
    });
    expect(wrapper.find('[data-testid="form-widget-stub"]').exists()).toBe(
      false,
    );
  });

  // W10: empty/unknown data does not render FormWidget.
  it('does NOT render FormWidget for empty/unknown data', () => {
    const wrapper = mountJson({});
    expect(wrapper.find('[data-testid="form-widget-stub"]').exists()).toBe(
      false,
    );
  });

  // W10: data with fields but no sendFormToEmail does not pass isFormWidgetData guard.
  it('does NOT render FormWidget when sendFormToEmail is missing', () => {
    const wrapper = mountJson({
      fields: [{ label: 'Name', name: 'name', required: true, type: 'input' }],
    });
    expect(wrapper.find('[data-testid="form-widget-stub"]').exists()).toBe(
      false,
    );
  });
});

describe('JsonWidget banner-cards placement', () => {
  function mountBannerCards(placement?: string) {
    return mountJson({
      templateId: 'banner-cards',
      bannerImages: [
        {
          text: { title: 'Heading', byline: 'Byline' },
          cta: placement ? { placement } : {},
        },
      ],
    });
  }

  // The overlay container drives both axes: justify-* (vertical) and
  // items-*/text-* (horizontal). The CMS placement string is `{h}-{v}`.
  it('centers both axes for "middle-center"', () => {
    const overlay = mountBannerCards('middle-center').find('.absolute.inset-0');
    expect(overlay.classes()).toContain('justify-center');
    expect(overlay.classes()).toContain('items-center');
    expect(overlay.classes()).toContain('text-center');
  });

  it('sits bottom-left for "left-bottom"', () => {
    const overlay = mountBannerCards('left-bottom').find('.absolute.inset-0');
    expect(overlay.classes()).toContain('justify-end');
    expect(overlay.classes()).toContain('items-start');
    expect(overlay.classes()).toContain('text-left');
  });

  it('maps "right-top" to top-right', () => {
    const overlay = mountBannerCards('right-top').find('.absolute.inset-0');
    expect(overlay.classes()).toContain('justify-start');
    expect(overlay.classes()).toContain('items-end');
    expect(overlay.classes()).toContain('text-right');
  });

  it('falls back to bottom-left when placement is missing', () => {
    const overlay = mountBannerCards().find('.absolute.inset-0');
    expect(overlay.classes()).toContain('justify-end');
    expect(overlay.classes()).toContain('items-start');
    expect(overlay.classes()).toContain('text-left');
  });
});

describe('JsonWidget collapse slider (cards-rich / cards-simple)', () => {
  // Slot scroll-state refs are module-level; reset between tests so the dots
  // test can't leak its scrollable state into a later one.
  afterEach(() => {
    canScrollPrev.value = false;
    canScrollNext.value = false;
  });

  const richItems = [
    { heading: 'A', description: 'a' },
    { heading: 'B', description: 'b' },
    { heading: 'C', description: 'c' },
  ];
  const simpleItems = [
    { title: 'A', url: '/a' },
    { title: 'B', url: '/b' },
    { title: 'C', url: '/c' },
  ];

  it('cards-rich stack renders only the grid, no carousel', () => {
    const wrapper = mountJson(
      { templateId: 'cards-rich', header: { heading: 'H' }, items: richItems },
      false,
    );
    expect(wrapper.find('[data-slot="carousel"]').exists()).toBe(false);
    expect(wrapper.find('.grid').exists()).toBe(true);
    expect(wrapper.findAll('h2')).toHaveLength(1);
  });

  it('cards-rich collapse keeps the header fixed and sliders the items on mobile', () => {
    canScrollNext.value = true;
    const wrapper = mountJson(
      { templateId: 'cards-rich', header: { heading: 'H' }, items: richItems },
      true,
    );
    // Header rendered once, OUTSIDE the slider (stays fixed above it).
    expect(wrapper.findAll('h2')).toHaveLength(1);
    const carousel = wrapper.find('[data-slot="carousel"]');
    expect(carousel.exists()).toBe(true);
    expect(carousel.classes()).toContain('md:hidden');
    expect(carousel.find('h2').exists()).toBe(false);
    // One slide per item.
    expect(wrapper.findAll('[data-slot="carousel-item"]')).toHaveLength(3);
    // Desktop grid kept, hidden below md so the slider owns mobile.
    const grid = wrapper.find('.md\\:grid-cols-3');
    expect(grid.classes()).toContain('hidden');
    expect(grid.classes()).toContain('md:grid');
  });

  it('cards-rich dots show only when the slider can scroll', () => {
    canScrollNext.value = false;
    const noScroll = mountJson(
      { templateId: 'cards-rich', items: [{ heading: 'only' }] },
      true,
    );
    expect(noScroll.find('[data-slot="carousel-dots"]').exists()).toBe(false);

    canScrollNext.value = true;
    const scrollable = mountJson(
      { templateId: 'cards-rich', items: richItems },
      true,
    );
    expect(scrollable.find('[data-slot="carousel-dots"]').exists()).toBe(true);
  });

  it('cards-simple collapse sliders the items; stack renders only the grid', () => {
    canScrollNext.value = true;
    const collapsed = mountJson(
      {
        templateId: 'cards-simple',
        header: { heading: 'H' },
        items: simpleItems,
      },
      true,
    );
    expect(collapsed.find('[data-slot="carousel"]').classes()).toContain(
      'md:hidden',
    );
    expect(collapsed.findAll('[data-slot="carousel-item"]')).toHaveLength(3);
    const grid = collapsed.find('.lg\\:grid-cols-4');
    expect(grid.classes()).toContain('hidden');
    expect(grid.classes()).toContain('md:grid');

    const stacked = mountJson(
      { templateId: 'cards-simple', items: simpleItems },
      false,
    );
    expect(stacked.find('[data-slot="carousel"]').exists()).toBe(false);
    expect(stacked.find('.lg\\:grid-cols-4').classes()).toContain('grid');
  });
});

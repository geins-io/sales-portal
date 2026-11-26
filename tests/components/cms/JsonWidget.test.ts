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

function mountJson(
  data: Record<string, unknown>,
  collapse = false,
  priority = false,
  edgeToEdge?: boolean,
) {
  return mountComponent(JsonWidget, {
    props: {
      data,
      config: baseConfig,
      layout: 'full',
      collapse,
      priority,
      edgeToEdge,
    },
    global: {
      stubs: {
        FormWidget: formWidgetStub,
        CmsWidgetsFormWidget: formWidgetStub,
        'i18n-t': i18nTStub,
        GeinsImage: {
          template:
            '<img data-testid="geins-image" :data-priority="String(priority)" :data-aspect-ratio="aspectRatio" :data-sizes="sizes" :data-fit="fit" />',
          props: {
            priority: Boolean,
            aspectRatio: String,
            sizes: String,
            fit: String,
          },
        },
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

describe('JsonWidget priority, when it opens the page', () => {
  const image = { src: 'a.jpg' };
  const priorities = (wrapper: ReturnType<typeof mountJson>) =>
    wrapper
      .findAll('[data-testid="geins-image"]')
      .map((img) => img.attributes('data-priority'));

  it('goes to the first banner card', () => {
    const wrapper = mountJson(
      { templateId: 'banner-cards', bannerImages: [{ image }, { image }] },
      false,
      true,
    );

    expect(priorities(wrapper)).toEqual(['true', 'false']);
  });

  it('goes to the first stacked card', () => {
    const wrapper = mountJson(
      { templateId: 'cards-rich', items: [{ image }, { image }] },
      false,
      true,
    );

    expect(priorities(wrapper)).toEqual(['true', 'false']);
  });

  it('goes to no card in a collapse slider, which renders each card twice', () => {
    const wrapper = mountJson(
      { templateId: 'cards-rich', items: [{ image }, { image }] },
      true,
      true,
    );

    expect(priorities(wrapper)).not.toContain('true');
  });

  it('goes to nothing unless the widget opens the page', () => {
    const wrapper = mountJson({
      templateId: 'banner-cards',
      bannerImages: [{ image }],
    });

    expect(priorities(wrapper)).toEqual(['false']);
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

describe('JsonWidget banner-cards gradient overlay', () => {
  const GRADIENT = ['bg-linear-to-t', 'from-black/60', 'to-transparent'];

  function overlays(gradientOverlay?: unknown) {
    const card = {
      text: { title: 'Heading', byline: 'Byline' },
      cta: { text: 'Shop', url: '/shop' },
    };
    return mountJson({
      templateId: 'banner-cards',
      ...(gradientOverlay === undefined ? {} : { gradientOverlay }),
      bannerImages: [card, card],
    }).findAll('.absolute.inset-0');
  }

  it.each([
    ['absent', undefined],
    ['true', true],
    ['the string "true"', 'true'],
  ])('puts the gradient on every card when the setting is %s', (_, value) => {
    const all = overlays(value);
    expect(all).toHaveLength(2);
    for (const overlay of all) {
      for (const cls of GRADIENT) expect(overlay.classes()).toContain(cls);
    }
  });

  it.each([
    ['false', false],
    ['the string "false"', 'false'],
  ])(
    'leaves the gradient off every card when the setting is %s',
    (_, value) => {
      const all = overlays(value);
      expect(all).toHaveLength(2);
      for (const overlay of all) {
        for (const cls of GRADIENT)
          expect(overlay.classes()).not.toContain(cls);
        expect(overlay.find('h3').classes()).toContain('text-white');
        expect(overlay.find('p').classes()).toContain('text-white/80');
        expect(overlay.find('a').exists()).toBe(true);
      }
    },
  );
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

describe('JsonWidget links with an unsafe scheme', () => {
  const unsafe = 'javascript:alert(1)';

  it('cards-rich leaves out the cta in both the slider and the grid', () => {
    const wrapper = mountJson(
      {
        templateId: 'cards-rich',
        items: [
          { heading: 'A', cta: { text: 'Go', url: unsafe } },
          { heading: 'B', cta: { text: 'Safe', url: '/b' } },
        ],
      },
      true,
    );
    const links = wrapper.findAll('a');
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.text() === 'Safe')).toBe(true);
  });

  it('cards-simple renders the card unlinked in both the slider and the grid', () => {
    const wrapper = mountJson(
      {
        templateId: 'cards-simple',
        items: [
          { title: 'Unsafe', url: unsafe },
          { title: 'Safe', url: '/b' },
        ],
      },
      true,
    );
    const links = wrapper.findAll('a');
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.text().includes('Safe'))).toBe(true);
    expect(links.some((link) => link.text().includes('Unsafe'))).toBe(false);
    expect(wrapper.text()).toContain('Unsafe');
  });

  it('text-+-cta leaves out the cta', () => {
    const wrapper = mountJson({
      templateId: 'text-+-cta',
      text: { header: 'Heading' },
      cta: { label: 'Go', url: unsafe },
    });
    expect(wrapper.find('a').exists()).toBe(false);
    expect(wrapper.text()).toContain('Heading');
  });

  it('banner-cards leaves out the cta', () => {
    const wrapper = mountJson({
      templateId: 'banner-cards',
      bannerImages: [
        { text: { title: 'Heading' }, cta: { text: 'Go', url: unsafe } },
      ],
    });
    expect(wrapper.find('a').exists()).toBe(false);
    expect(wrapper.text()).toContain('Heading');
  });
});

describe('JsonWidget cropping boxes', () => {
  const ratios = (wrapper: ReturnType<typeof mountJson>) =>
    wrapper
      .findAll('[data-testid="geins-image"]')
      .map((img) => img.attributes('data-aspect-ratio'));

  it.each([false, true])(
    'shapes each simple card square from the image (collapse: %s)',
    (collapse) => {
      const wrapper = mountJson(
        {
          templateId: 'cards-simple',
          items: [
            { title: 'A', url: '/a', src: 'a.jpg' },
            { title: 'B', url: '/b', src: 'b.jpg' },
          ],
        },
        collapse,
      );

      expect(ratios(wrapper).length).toBeGreaterThan(0);
      expect(ratios(wrapper).every((r) => r === '1')).toBe(true);
    },
  );

  it.each([false, true])(
    'keeps a square box for a simple card without an image (collapse: %s)',
    (collapse) => {
      const wrapper = mountJson(
        {
          templateId: 'cards-simple',
          items: [{ title: 'A', url: '/a' }],
        },
        collapse,
      );

      expect(wrapper.find('[data-testid="geins-image"]').exists()).toBe(false);
      const boxes = wrapper.findAll('.bg-muted');
      expect(boxes.length).toBeGreaterThan(0);
      expect(
        boxes.every((box) => box.classes().includes('aspect-square')),
      ).toBe(true);
    },
  );

  it('shapes each banner card 16:9 from the image', () => {
    const wrapper = mountJson({
      templateId: 'banner-cards',
      bannerImages: [{ image: { src: 'a.jpg' } }, { image: { src: 'b.jpg' } }],
    });

    expect(ratios(wrapper)).toEqual(['16/9', '16/9']);
  });

  it('leaves natural images unshaped', () => {
    const wrapper = mountJson({
      templateId: 'cards-rich',
      items: [{ image: { src: 'a.jpg' } }],
    });

    expect(ratios(wrapper)).toEqual([undefined]);
  });
});

describe('JsonWidget cards-rich header alignment', () => {
  function headerBox(textAlign?: string) {
    const wrapper = mountJson({
      templateId: 'cards-rich',
      header: { heading: 'H', description: 'D', textAlign },
      items: [],
    });
    return wrapper.find('h2').element.parentElement!.classList;
  }

  it('starts at the content edge when left aligned or unset, like the cards', () => {
    for (const align of [undefined, 'left', 'unknown']) {
      const box = headerBox(align);
      expect([...box], String(align)).not.toContain('mx-auto');
      expect([...box]).not.toContain('ml-auto');
      expect([...box]).not.toContain('text-center');
      expect([...box]).not.toContain('text-right');
      expect([...box]).toContain('max-w-[670px]');
    }
  });

  it('sits in the middle when centred', () => {
    const box = [...headerBox('center')];
    expect(box).toEqual(expect.arrayContaining(['mx-auto', 'text-center']));
    expect(box).toContain('max-w-[670px]');
  });

  it('ends at the content edge, text right aligned, when right aligned', () => {
    const box = [...headerBox('right')];
    expect(box).toEqual(expect.arrayContaining(['ml-auto', 'text-right']));
    expect(box).not.toContain('mx-auto');
    expect(box).toContain('max-w-[670px]');
  });
});

describe('JsonWidget cards-rich in an edge-to-edge container', () => {
  const block = {
    templateId: 'cards-rich',
    settings: { spacing: false },
    header: { heading: 'H', description: 'D', textAlign: 'right' },
    items: [{ text: { heading: 'a' } }, { text: { heading: 'b' } }],
  };
  const headerBox = (wrapper: ReturnType<typeof mountJson>) =>
    wrapper.find('h2').element.parentElement!;

  it('keeps the header in the gutter, its cap and alignment unchanged', () => {
    const box = headerBox(mountJson(block, false, false, true));
    expect([...box.classList]).toEqual(
      expect.arrayContaining(['max-w-[670px]', 'ml-auto', 'text-right']),
    );
    expect([...box.classList]).not.toContain('content-gutter');
    expect([...box.parentElement!.classList]).toEqual(['content-gutter']);
  });

  it('leaves the cards at the edge', () => {
    const wrapper = mountJson(block, false, false, true);
    const grid = wrapper.find('[data-testid="cards-rich-grid"]');
    expect(grid.classes()).not.toContain('content-gutter');
    expect(grid.element.closest('.content-gutter')).toBeNull();
  });

  it('adds no gutter when the container keeps its own', () => {
    const wrapper = mountJson(block);
    expect(wrapper.find('.content-gutter').exists()).toBe(false);
  });
});

describe('JsonWidget cards-rich settings', () => {
  const image = { src: 'a.jpg', srcPath: 'content/a.jpg', alt: 'A' };
  // The start page's live block: flat cards with cta, no settings.
  const flatCard = (heading: string) => ({
    heading,
    description: `${heading} text`,
    image,
    cta: { text: `${heading} link`, url: `/${heading}` },
  });
  const textCard = (text: Record<string, unknown>) => ({ text });
  const cards = (wrapper: ReturnType<typeof mountJson>) =>
    wrapper.findAll('[data-testid="cards-rich-card"]');
  const grid = (wrapper: ReturnType<typeof mountJson>) =>
    wrapper.find('[data-testid="cards-rich-grid"]');
  const sizes = (wrapper: ReturnType<typeof mountJson>) =>
    wrapper
      .findAll('[data-testid="geins-image"]')
      .map((img) => img.attributes('data-sizes'));
  const BUTTON =
    'bg-button-background text-button-text inline-block rounded-md px-4 py-2 text-sm font-medium';

  it('renders a flat block with cta as today', () => {
    const wrapper = mountJson({
      templateId: 'cards-rich',
      header: { heading: 'H', textAlign: 'center' },
      items: [flatCard('a'), flatCard('b'), flatCard('c')],
    });

    expect(grid(wrapper).classes()).toEqual(
      expect.arrayContaining(['grid', 'gap-6', 'md:grid-cols-3']),
    );
    const card = cards(wrapper)[0]!;
    expect(card.classes()).toEqual(
      expect.arrayContaining([
        'bg-card',
        'border-card-border',
        'overflow-hidden',
        'rounded-md',
        'border',
      ]),
    );
    expect(card.attributes('style')).toBeUndefined();
    expect(card.find('h3').text()).toBe('a');
    expect(card.find('h3').classes()).toEqual([
      'font-heading',
      'text-lg',
      'font-semibold',
    ]);
    expect(card.find('p').text()).toBe('a text');
    expect(card.find('p').classes()).toEqual(
      expect.arrayContaining(['text-muted-foreground', 'text-sm']),
    );
    const link = card.find('a');
    expect(link.text()).toBe('a link');
    expect(link.classes().join(' ')).toBe(BUTTON);
    const text = card.find('[data-testid="cards-rich-card-text"]');
    expect(text.classes()).toEqual(
      expect.arrayContaining(['p-4', 'items-start', 'text-left']),
    );
    expect(text.classes()).toContain('justify-start');
    expect(
      card.find('[data-testid="geins-image"]').attributes('data-fit'),
    ).toBe('natural');
  });

  it('reads the grouped shape: text, image and button', () => {
    const wrapper = mountJson({
      templateId: 'cards-rich',
      settings: { cardsPerRow: 'dynamic', spacing: true },
      items: [
        {
          text: { heading: 'Rent', description: 'By the day' },
          image,
          button: { text: 'Read more', url: '/rent', buttonStyle: 'button' },
        },
      ],
    });

    const card = cards(wrapper)[0]!;
    expect(card.find('h3').text()).toBe('Rent');
    expect(card.find('p').text()).toBe('By the day');
    expect(card.find('[data-testid="geins-image"]').exists()).toBe(true);
    expect(card.find('a').text()).toBe('Read more');
    expect(card.find('a').classes().join(' ')).toBe(BUTTON);
  });

  it.each([
    [{}, 2, 'md:grid-cols-2', '(min-width: 768px) 50vw, 100vw'],
    [{}, 3, 'md:grid-cols-3', '(min-width: 768px) 33vw, 100vw'],
    [
      { cardsPerRow: 'dynamic' },
      1,
      'md:grid-cols-2',
      '(min-width: 768px) 50vw, 100vw',
    ],
    [{ cardsPerRow: '1' }, 3, 'md:grid-cols-1', '100vw'],
    [{ cardsPerRow: 2 }, 3, 'md:grid-cols-2', '(min-width: 768px) 50vw, 100vw'],
    [
      { cardsPerRow: '3' },
      2,
      'md:grid-cols-3',
      '(min-width: 768px) 33vw, 100vw',
    ],
    [
      { cardsPerRow: '4' },
      4,
      'md:grid-cols-2 lg:grid-cols-4',
      '(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw',
    ],
    [
      { cardsPerRow: '7' },
      4,
      'md:grid-cols-3',
      '(min-width: 768px) 33vw, 100vw',
    ],
  ])(
    'settings %j with %i cards: %s, images sized %s',
    (settings, count, columns, imageSizes) => {
      const wrapper = mountJson({
        templateId: 'cards-rich',
        settings,
        items: Array.from({ length: count }, (_, i) => flatCard(`c${i}`)),
      });

      const classes = grid(wrapper).classes();
      for (const column of columns.split(' '))
        expect(classes).toContain(column);
      const other = [
        'md:grid-cols-1',
        'md:grid-cols-2',
        'md:grid-cols-3',
        'lg:grid-cols-4',
      ].filter((c) => !columns.split(' ').includes(c));
      for (const column of other) expect(classes).not.toContain(column);
      expect(new Set(sizes(wrapper))).toEqual(new Set([imageSizes]));
    },
  );

  it('sets the cards edge to edge, square, when spacing is off', () => {
    const wrapper = mountJson({
      templateId: 'cards-rich',
      settings: { spacing: false },
      items: [flatCard('a'), flatCard('b')],
    });

    expect(grid(wrapper).classes()).toContain('gap-0');
    expect(grid(wrapper).classes()).not.toContain('gap-6');
    for (const card of cards(wrapper)) {
      expect(card.classes()).toContain('rounded-none');
      expect(card.classes()).not.toContain('rounded-md');
      expect(card.classes()).toContain('border');
    }
  });

  it.each([
    ['left', 'top', ['items-start', 'text-left', 'justify-start']],
    ['center', 'center', ['items-center', 'text-center', 'justify-center']],
    ['right', 'bottom', ['items-end', 'text-right', 'justify-end']],
  ])('places the text %s / %s', (textAlign, verticalAlign, expected) => {
    const wrapper = mountJson({
      templateId: 'cards-rich',
      items: [textCard({ heading: 'A', textAlign, verticalAlign })],
    });

    const text = wrapper.find('[data-testid="cards-rich-card-text"]');
    expect(text.classes()).toEqual(
      expect.arrayContaining(['flex', 'flex-1', 'flex-col', ...expected]),
    );
  });

  it('paints a valid background and text colour, the description lighter', () => {
    const wrapper = mountJson({
      templateId: 'cards-rich',
      items: [
        {
          ...textCard({
            heading: 'A',
            description: 'a',
            backgroundColor: '#1e3a5f',
            textColor: '#ffffff',
          }),
          button: { text: 'Go', url: '/a' },
        },
      ],
    });

    const card = cards(wrapper)[0]!;
    expect(card.attributes('style')).toContain('background-color: #1e3a5f');
    expect(card.attributes('style')).toContain('color: #ffffff');
    expect(card.find('p').classes()).toContain('opacity-80');
    expect(card.find('p').classes()).not.toContain('text-muted-foreground');
    // The button keeps the store's colours.
    expect(card.find('a').classes().join(' ')).toBe(BUTTON);
  });

  it('paints only the colour that is set', () => {
    const wrapper = mountJson({
      templateId: 'cards-rich',
      items: [
        textCard({
          heading: 'A',
          description: 'a',
          backgroundColor: '#f3e8d0',
        }),
      ],
    });

    const card = cards(wrapper)[0]!;
    expect(card.attributes('style')).toBe('background-color: #f3e8d0;');
    expect(card.find('p').classes()).toContain('text-muted-foreground');
  });

  it('ignores empty and invalid colours', () => {
    const wrapper = mountJson({
      templateId: 'cards-rich',
      items: [
        textCard({ heading: 'A', backgroundColor: '', textColor: '' }),
        textCard({
          heading: 'B',
          backgroundColor: 'red; background-image: url(x)',
          textColor: 'var(--x)',
        }),
      ],
    });

    for (const card of cards(wrapper))
      expect(card.attributes('style')).toBeUndefined();
  });

  it('draws a link style button as an underlined text link', () => {
    const wrapper = mountJson({
      templateId: 'cards-rich',
      items: [
        {
          ...textCard({ heading: 'A' }),
          button: { text: 'Go', url: '/a', buttonStyle: 'link' },
        },
      ],
    });

    const link = wrapper.find('a');
    expect(link.text()).toBe('Go');
    expect(link.classes()).toEqual(
      expect.arrayContaining(['underline', 'text-sm', 'font-medium']),
    );
    expect(link.classes()).not.toContain('bg-button-background');
  });

  it('fills an image-only card with its image, without a text box', () => {
    const wrapper = mountJson({
      templateId: 'cards-rich',
      items: [
        { image, button: { text: 'Go', url: 'javascript:alert(1)' } },
        flatCard('b'),
      ],
    });

    const [only, full] = cards(wrapper);
    expect(only!.find('[data-testid="cards-rich-card-text"]').exists()).toBe(
      false,
    );
    const img = only!.find('[data-testid="geins-image"]');
    expect(img.attributes('data-fit')).toBe('cover');
    expect(img.classes()).toContain('h-full');
    expect(
      full!.find('[data-testid="geins-image"]').attributes('data-fit'),
    ).toBe('natural');
  });

  it('draws no image area for a card without an image', () => {
    const wrapper = mountJson({
      templateId: 'cards-rich',
      items: [textCard({ heading: 'A' })],
    });

    expect(wrapper.find('[data-testid="geins-image"]').exists()).toBe(false);
  });

  it.each([
    [{}, 2],
    [{ cardsPerRow: '1' }, 1],
    [{ cardsPerRow: '2' }, 4],
  ])(
    'makes a text-only card a text banner (settings %j, %i cards)',
    (settings, count) => {
      const wrapper = mountJson({
        templateId: 'cards-rich',
        settings,
        items: Array.from({ length: count }, () =>
          textCard({ heading: 'Big', description: 'text' }),
        ),
      });

      const card = cards(wrapper)[0]!;
      expect(card.find('h3').classes()).toEqual(
        expect.arrayContaining(['text-[32px]', 'md:text-[40px]', 'font-bold']),
      );
      expect(card.find('p').classes()).toEqual(
        expect.arrayContaining(['text-lg', 'md:text-xl']),
      );
      expect(
        card.find('[data-testid="cards-rich-card-text"]').classes(),
      ).toEqual(expect.arrayContaining(['p-8', 'md:p-12']));
    },
  );

  it.each([
    [{}, 3],
    [{ cardsPerRow: '4' }, 2],
  ])(
    'gives a text-only card a 24 px heading (settings %j, %i cards)',
    (settings, count) => {
      const wrapper = mountJson({
        templateId: 'cards-rich',
        settings,
        items: Array.from({ length: count }, () =>
          textCard({ heading: 'Mid', description: 'text' }),
        ),
      });

      const card = cards(wrapper)[0]!;
      expect(card.find('h3').classes()).toContain('text-2xl');
      expect(card.find('h3').classes()).not.toContain('text-[32px]');
      expect(card.find('p').classes()).toContain('text-sm');
      expect(
        card.find('[data-testid="cards-rich-card-text"]').classes(),
      ).toContain('p-4');
    },
  );

  it('applies the text-card rule to a flat card without an image too', () => {
    const wrapper = mountJson({
      templateId: 'cards-rich',
      items: [{ heading: 'Flat', cta: { text: 'Go', url: '/a' } }],
    });

    expect(wrapper.find('h3').classes()).toContain('text-[32px]');
  });

  it('collapse: full-width slides sized to the screen, one card component each', () => {
    const items = [flatCard('a'), textCard({ heading: 'B' })];
    const wrapper = mountJson(
      { templateId: 'cards-rich', settings: { cardsPerRow: '4' }, items },
      true,
    );

    const slides = wrapper.findAll('[data-slot="carousel-item"]');
    expect(slides).toHaveLength(2);
    for (const slide of slides) {
      expect(slide.classes()).toContain('basis-full');
      expect(slide.classes()).not.toContain('basis-4/5');
      expect(slide.findAll('[data-testid="cards-rich-card"]')).toHaveLength(1);
    }
    expect(
      slides[0]!.find('[data-testid="geins-image"]').attributes('data-sizes'),
    ).toBe('100vw');
    // Slide and grid cell render the same card.
    expect(cards(wrapper)).toHaveLength(4);
    expect(
      grid(wrapper).findAll('[data-testid="cards-rich-card"]'),
    ).toHaveLength(2);
    expect(cards(wrapper)[0]!.html()).toContain('a text');
    expect(cards(wrapper)[2]!.html()).toContain('a text');
  });
});

describe('JsonWidget usp', () => {
  afterEach(() => {
    canScrollPrev.value = false;
    canScrollNext.value = false;
  });

  const point = (n: number) => ({
    icon: 'local_shipping',
    heading: `Heading ${n}`,
    description: `Text ${n}`,
  });
  const usp = (count: number, extra: Record<string, unknown> = {}) => ({
    templateId: 'usp',
    items: Array.from({ length: count }, (_, i) => point(i + 1)),
    ...extra,
  });
  const items = (wrapper: ReturnType<typeof mountJson>) =>
    wrapper.find('[data-testid="usp-list"]').findAll('li');
  const block = (wrapper: ReturnType<typeof mountJson>) =>
    wrapper.find('[data-testid="usp"]');

  it('shows each selling point centred: icon, then heading, then text', () => {
    const wrapper = mountJson(usp(3));
    expect(items(wrapper)).toHaveLength(3);
    const item = items(wrapper)[1]!;
    expect(item.classes()).toEqual(
      expect.arrayContaining([
        'flex',
        'flex-col',
        'items-center',
        'text-center',
      ]),
    );
    const tags = (el: Element) =>
      [...el.children].map((child) => child.tagName.toLowerCase());
    expect(tags(item.element)).toEqual(['span', 'div']);
    expect(tags(item.find('[data-testid="usp-text"]').element)).toEqual([
      'h3',
      'p',
    ]);
    expect(item.find('h3').text()).toBe('Heading 2');
    expect(item.find('p').text()).toBe('Text 2');
  });

  it('keeps 8 px between icon and heading, 4 px between heading and text', () => {
    const wrapper = mountJson(usp(1), true);
    const slide = wrapper.find('[data-slot="carousel-item"] > div');
    for (const item of [items(wrapper)[0]!, slide]) {
      expect(item.classes()).toContain('gap-2');
      const text = item.find('[data-testid="usp-text"]');
      expect(text.classes()).toEqual(
        expect.arrayContaining(['flex', 'flex-col', 'items-center', 'gap-1']),
      );
      expect(text.classes()).not.toContain('gap-2');
    }
  });

  it('draws no text group for a selling point with only an icon', () => {
    const item = items(mountJson(usp(1, { items: [{ icon: 'eco' }] })))[0]!;
    expect(item.find('[data-testid="usp-icon-box"]').exists()).toBe(true);
    expect(item.find('[data-testid="usp-text"]').exists()).toBe(false);
  });

  it('draws the rounded outline icon in a 32 px box, as svg, hidden from readers', () => {
    const item = items(
      mountJson(usp(1, { items: [{ ...point(1), icon: 'Local Shipping' }] })),
    )[0]!;
    const box = item.find('[data-testid="usp-icon-box"]');
    expect(box.classes()).toContain('size-8');
    // The shared Icon stub (tests/utils/component.ts).
    const icon = box.find('.icon');
    expect(icon.attributes('data-name')).toBe(
      'material-symbols:local-shipping-outline-rounded',
    );
    expect(icon.attributes('mode')).toBe('svg');
    expect(icon.classes()).toContain('size-8');
    expect(icon.attributes('aria-hidden')).toBe('true');
  });

  it('shows heading and text without an icon when the name is empty or malformed', () => {
    const wrapper = mountJson(
      usp(2, {
        items: [
          { icon: '', heading: 'A', description: 'a' },
          { icon: 'bad;name', heading: 'B', description: 'b' },
        ],
      }),
    );
    expect(items(wrapper)).toHaveLength(2);
    expect(wrapper.find('[data-testid="usp-icon-box"]').exists()).toBe(false);
    expect(wrapper.findAll('h3').map((h) => h.text())).toEqual(['A', 'B']);
  });

  it('leaves out a heading or text that is empty', () => {
    const item = items(
      mountJson(usp(1, { items: [{ icon: 'eco', heading: 'Only' }] })),
    )[0]!;
    expect(item.find('h3').text()).toBe('Only');
    expect(item.find('p').exists()).toBe(false);
  });

  it('sizes the heading 18 px, 20 px from tablet, and the text 14 px', () => {
    const item = items(mountJson(usp(1)))[0]!;
    expect(item.find('h3').classes()).toEqual(
      expect.arrayContaining(['text-lg', 'md:text-xl']),
    );
    expect(item.find('p').classes()).toContain('text-sm');
  });

  it.each([
    [1, 'md:w-full', 'lg:w-full'],
    [2, 'md:w-1/2', 'lg:w-1/2'],
    [3, 'md:w-1/3', 'lg:w-1/3'],
    [4, 'md:w-1/2', 'lg:w-1/4'],
    [5, 'md:w-1/3', 'lg:w-1/3'],
    [6, 'md:w-1/3', 'lg:w-1/3'],
    [7, 'md:w-1/2', 'lg:w-1/4'],
    [8, 'md:w-1/2', 'lg:w-1/4'],
    [9, 'md:w-1/3', 'lg:w-1/3'],
  ])(
    '%i selling points: %s on tablet, %s on desktop, full width on mobile',
    (count, md, lg) => {
      const wrapper = mountJson(usp(count));
      for (const item of items(wrapper)) {
        expect(item.classes()).toEqual(
          expect.arrayContaining(['w-full', md, lg]),
        );
      }
    },
  );

  it('centres the last row', () => {
    const list = mountJson(usp(5)).find('[data-testid="usp-list"]');
    expect(list.classes()).toEqual(
      expect.arrayContaining(['flex', 'flex-wrap', 'justify-center']),
    );
  });

  it('shows an optional header, centred, above the selling points', () => {
    const wrapper = mountJson(
      usp(2, { header: { heading: 'Why us', description: 'Reasons' } }),
    );
    const heading = wrapper.find('h2');
    expect(heading.text()).toBe('Why us');
    const header = heading.element.parentElement!;
    expect([...header.classList]).toEqual(
      expect.arrayContaining(['mx-auto', 'text-center']),
    );
    expect(header.textContent).toContain('Reasons');
    expect(
      header.compareDocumentPosition(
        wrapper.find('[data-testid="usp-list"]').element,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('has no header when both its fields are empty', () => {
    const wrapper = mountJson(
      usp(1, { header: { heading: '', description: '' } }),
    );
    expect(wrapper.find('h2').exists()).toBe(false);
  });

  it('without colours sits on the page: no style, no padding, primary icons', () => {
    const wrapper = mountJson(
      usp(1, { settings: { backgroundColor: '', textColor: '' } }),
    );
    expect(block(wrapper).attributes('style')).toBeUndefined();
    expect(block(wrapper).classes()).not.toContain('py-10');
    expect(wrapper.find('[data-testid="usp-icon-box"]').classes()).toContain(
      'text-primary',
    );
    expect(items(wrapper)[0]!.find('p').classes()).toContain(
      'text-muted-foreground',
    );
  });

  it('paints the background over the whole block, with padding above and below', () => {
    const wrapper = mountJson(
      usp(1, { settings: { backgroundColor: '#0b2e4f' } }),
    );
    expect(block(wrapper).attributes('style')).toContain(
      'background-color: #0b2e4f',
    );
    expect(block(wrapper).attributes('style')).not.toMatch(/(^|;\s*)color:/);
    expect(block(wrapper).classes()).toEqual(
      expect.arrayContaining(['py-10', 'md:py-12']),
    );
  });

  it('with a text colour, icons, headings and texts follow it, the texts lighter', () => {
    const wrapper = mountJson(
      usp(1, {
        header: { heading: 'H', description: 'D' },
        settings: { backgroundColor: '#0b2e4f', textColor: '#ffffff' },
      }),
    );
    expect(block(wrapper).attributes('style')).toContain('color: #ffffff');
    expect(
      wrapper.find('[data-testid="usp-icon-box"]').classes(),
    ).not.toContain('text-primary');
    for (const p of wrapper.findAll('p')) {
      expect(p.classes()).toContain('opacity-80');
      expect(p.classes()).not.toContain('text-muted-foreground');
    }
  });

  it('ignores an invalid colour', () => {
    const wrapper = mountJson(
      usp(1, {
        settings: { backgroundColor: 'red;x:y', textColor: 'url(x)' },
      }),
    );
    expect(block(wrapper).attributes('style')).toBeUndefined();
    expect(block(wrapper).classes()).not.toContain('py-10');
  });

  it('as an edge-to-edge band, keeps its content in the content column', () => {
    const wrapper = mountJson(
      usp(2, { settings: { backgroundColor: '#000' } }),
      false,
      false,
      true,
    );
    const inner = wrapper.find('[data-testid="usp-content"]');
    expect(inner.classes()).toContain('content-column');
    expect(inner.classes()).not.toContain('content-gutter');
  });

  it('with a background inside the column, keeps its content off the band edge', () => {
    const inner = mountJson(
      usp(2, { settings: { backgroundColor: '#000' } }),
    ).find('[data-testid="usp-content"]');
    expect(inner.classes()).toContain('content-gutter');
    expect(inner.classes()).not.toContain('content-column');
  });

  it('without a background adds no column or gutter of its own', () => {
    const inner = mountJson(usp(2)).find('[data-testid="usp-content"]');
    expect(inner.classes()).not.toContain('content-gutter');
    expect(inner.classes()).not.toContain('content-column');
  });

  it('stack: the rows on every screen, no slider', () => {
    const wrapper = mountJson(usp(3), false);
    expect(wrapper.find('[data-slot="carousel"]').exists()).toBe(false);
    const list = wrapper.find('[data-testid="usp-list"]');
    expect(list.classes()).toContain('flex');
    expect(list.classes()).not.toContain('hidden');
  });

  it('collapse: one full-width selling point per slide on mobile, the rows from tablet', () => {
    canScrollNext.value = true;
    const wrapper = mountJson(usp(3, { header: { heading: 'H' } }), true);
    const carousel = wrapper.find('[data-slot="carousel"]');
    expect(carousel.classes()).toContain('md:hidden');
    const slides = wrapper.findAll('[data-slot="carousel-item"]');
    expect(slides).toHaveLength(3);
    for (const slide of slides) expect(slide.classes()).toContain('basis-full');
    expect(slides[0]!.find('h3').text()).toBe('Heading 1');
    expect(slides[0]!.find('.icon').exists()).toBe(true);
    expect(wrapper.find('[data-slot="carousel-dots"]').exists()).toBe(true);
    // The header stays above the slider.
    expect(carousel.find('h2').exists()).toBe(false);
    const list = wrapper.find('[data-testid="usp-list"]');
    expect(list.classes()).toEqual(
      expect.arrayContaining(['hidden', 'md:flex']),
    );
  });

  it('collapse: no dots when the slider cannot scroll', () => {
    const wrapper = mountJson(usp(1), true);
    expect(wrapper.find('[data-slot="carousel-dots"]').exists()).toBe(false);
  });

  it('renders nothing for a block without selling points or header', () => {
    const wrapper = mountJson({ templateId: 'usp' });
    expect(wrapper.text()).not.toContain('Unknown template');
    expect(wrapper.find('li').exists()).toBe(false);
  });
});

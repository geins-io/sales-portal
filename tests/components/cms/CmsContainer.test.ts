import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import CmsContainer from '../../../app/components/cms/CmsContainer.vue';

const widgetStub = {
  template: '<div class="cms-widget" />',
  props: ['widget', 'layout'],
};

const stubs = {
  CmsWidget: widgetStub,
  CmsCmsWidget: widgetStub,
};

function makeWidget(
  overrides: { active?: boolean; sortOrder?: number; type?: string } = {},
) {
  return {
    config: {
      name: 'w',
      displayName: 'Widget',
      active: overrides.active ?? true,
      type: overrides.type ?? 'TextPageWidget',
      size: 'full',
      sortOrder: overrides.sortOrder ?? 0,
    },
    data: { name: 'w', active: true, text: '<p>hi</p>' },
  };
}

function makeContainer(
  layout: string,
  content: ReturnType<typeof makeWidget>[] = [],
  design = '',
  visibility?: 'always' | 'mobile' | 'desktop',
) {
  return {
    id: '1',
    name: 'test',
    sortOrder: 0,
    layout,
    // responsiveMode is the "Mobile behavior" stacking value, not visibility.
    responsiveMode: 'stack',
    design,
    content,
    visibility,
  };
}

describe('CmsContainer', () => {
  describe('layout class mapping', () => {
    it('applies grid-cols-1 for full layout', () => {
      const wrapper = mountComponent(CmsContainer, {
        props: { container: makeContainer('full', [makeWidget()]) },
        global: { stubs },
      });
      expect(wrapper.find('.grid-cols-1').exists()).toBe(true);
    });

    it('applies md:grid-cols-2 for half layout', () => {
      const wrapper = mountComponent(CmsContainer, {
        props: { container: makeContainer('half', [makeWidget()]) },
        global: { stubs },
      });
      expect(wrapper.find('.md\\:grid-cols-2').exists()).toBe(true);
    });

    it('applies md:grid-cols-3 for third layout', () => {
      const wrapper = mountComponent(CmsContainer, {
        props: { container: makeContainer('third', [makeWidget()]) },
        global: { stubs },
      });
      expect(wrapper.find('.md\\:grid-cols-3').exists()).toBe(true);
    });

    it('applies lg:grid-cols-4 for quarter layout', () => {
      const wrapper = mountComponent(CmsContainer, {
        props: { container: makeContainer('quarter', [makeWidget()]) },
        global: { stubs },
      });
      expect(wrapper.find('.lg\\:grid-cols-4').exists()).toBe(true);
    });

    it('defaults to grid-cols-1 for unknown layout', () => {
      const wrapper = mountComponent(CmsContainer, {
        props: { container: makeContainer('unknown', [makeWidget()]) },
        global: { stubs },
      });
      expect(wrapper.find('.grid-cols-1').exists()).toBe(true);
    });
  });

  describe('filtering and sorting', () => {
    it('filters out inactive widgets', () => {
      const container = makeContainer('full', [
        makeWidget({ active: true, sortOrder: 0 }),
        makeWidget({ active: false, sortOrder: 1 }),
        makeWidget({ active: true, sortOrder: 2 }),
      ]);
      const wrapper = mountComponent(CmsContainer, {
        props: { container },
        global: { stubs },
      });
      expect(wrapper.findAll('.cms-widget')).toHaveLength(2);
    });

    it('sorts widgets by sortOrder', () => {
      const w1 = makeWidget({ sortOrder: 2 });
      const w2 = makeWidget({ sortOrder: 0 });
      const w3 = makeWidget({ sortOrder: 1 });
      const container = makeContainer('full', [w1, w2, w3]);
      const wrapper = mountComponent(CmsContainer, {
        props: { container },
        global: { stubs },
      });
      // All three should render (all active)
      expect(wrapper.findAll('.cms-widget')).toHaveLength(3);
    });
  });

  describe('empty state', () => {
    it('renders nothing when content is empty', () => {
      const wrapper = mountComponent(CmsContainer, {
        props: { container: makeContainer('full', []) },
        global: { stubs },
      });
      expect(wrapper.find('section').exists()).toBe(false);
    });

    it('renders nothing when all widgets are inactive', () => {
      const container = makeContainer('full', [
        makeWidget({ active: false }),
        makeWidget({ active: false }),
      ]);
      const wrapper = mountComponent(CmsContainer, {
        props: { container },
        global: { stubs },
      });
      expect(wrapper.find('section').exists()).toBe(false);
    });
  });

  describe('design classes', () => {
    it('applies contained design classes', () => {
      const container = makeContainer('full', [makeWidget()], 'contained');
      const wrapper = mountComponent(CmsContainer, {
        props: { container },
        global: { stubs },
      });
      expect(wrapper.find('section').classes()).toContain('max-w-7xl');
    });

    it('applies narrow design classes', () => {
      const container = makeContainer('full', [makeWidget()], 'narrow');
      const wrapper = mountComponent(CmsContainer, {
        props: { container },
        global: { stubs },
      });
      expect(wrapper.find('section').classes()).toContain('max-w-3xl');
    });

    it('applies max-w-7xl for default design', () => {
      const container = makeContainer('full', [makeWidget()], '');
      const wrapper = mountComponent(CmsContainer, {
        props: { container },
        global: { stubs },
      });
      expect(wrapper.find('section').classes()).toContain('max-w-7xl');
    });

    it('applies w-full for full-width design', () => {
      const container = makeContainer('full', [makeWidget()], 'full-width');
      const wrapper = mountComponent(CmsContainer, {
        props: { container },
        global: { stubs },
      });
      expect(wrapper.find('section').classes()).toContain('w-full');
    });

    it('drops max-width and horizontal padding when flush, keeping py-4', () => {
      const container = makeContainer('full', [makeWidget()], 'contained');
      const wrapper = mountComponent(CmsContainer, {
        props: { container, flush: true },
        global: { stubs },
      });
      const classes = wrapper.find('section').classes();
      expect(classes).not.toContain('max-w-7xl');
      expect(classes).not.toContain('px-4');
      expect(classes).not.toContain('lg:px-6');
      // Vertical spacing is unchanged so the hero keeps its rhythm.
      expect(classes).toContain('py-4');
    });
  });

  describe('visibility (Display settings)', () => {
    it('hides a mobile-only container from the md breakpoint up', () => {
      const container = makeContainer('full', [makeWidget()], '', 'mobile');
      const wrapper = mountComponent(CmsContainer, {
        props: { container },
        global: { stubs },
      });
      expect(wrapper.find('section').classes()).toContain('md:hidden');
    });

    it('hides a desktop-only container below the md breakpoint', () => {
      const container = makeContainer('full', [makeWidget()], '', 'desktop');
      const wrapper = mountComponent(CmsContainer, {
        props: { container },
        global: { stubs },
      });
      const classes = wrapper.find('section').classes();
      expect(classes).toContain('hidden');
      expect(classes).toContain('md:block');
    });

    it('adds no visibility class for the always-visible value', () => {
      const container = makeContainer('full', [makeWidget()], '', 'always');
      const wrapper = mountComponent(CmsContainer, {
        props: { container },
        global: { stubs },
      });
      const classes = wrapper.find('section').classes();
      expect(classes).not.toContain('md:hidden');
      expect(classes).not.toContain('hidden');
    });
  });

  describe('rich-text framing (frameRichText)', () => {
    const richTextWidget = () => makeWidget({ type: 'Rich textPageWidget' });

    it('frames a rich-text block as a wide card with a capped content column', () => {
      const container = makeContainer('full', [richTextWidget()], 'contained');
      const wrapper = mountComponent(CmsContainer, {
        props: { container, frameRichText: true },
        global: { stubs },
      });
      // Outer section is the full-width gutter, not the white card itself.
      const section = wrapper.find('section').classes();
      expect(section).toContain('max-w-7xl');
      expect(section).not.toContain('bg-white');
      expect(section).not.toContain('max-w-2xl');
      // The white bordered card spans the wide content width.
      const card = wrapper.find('.bg-white');
      expect(card.exists()).toBe(true);
      expect(card.classes()).toContain('border');
      expect(card.classes()).toContain('rounded-lg');
      expect(card.classes()).not.toContain('max-w-2xl');
      // The copy inside is capped to a reading column.
      const content = wrapper.find('.max-w-2xl');
      expect(content.exists()).toBe(true);
      expect(content.classes()).toContain('grid-cols-1');
    });

    it('leaves a block without a rich-text widget full-bleed even when frameRichText is set', () => {
      const container = makeContainer(
        'full',
        [makeWidget({ type: 'BannerPageWidget' })],
        'contained',
      );
      const wrapper = mountComponent(CmsContainer, {
        props: { container, frameRichText: true },
        global: { stubs },
      });
      const classes = wrapper.find('section').classes();
      expect(classes).not.toContain('bg-white');
      expect(classes).toContain('max-w-7xl');
    });

    it('does not frame a rich-text block when frameRichText is absent', () => {
      const container = makeContainer('full', [richTextWidget()], 'contained');
      const wrapper = mountComponent(CmsContainer, {
        props: { container },
        global: { stubs },
      });
      const classes = wrapper.find('section').classes();
      expect(classes).not.toContain('bg-white');
      expect(classes).toContain('max-w-7xl');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import TextWidget from '../../../app/components/cms/widgets/TextWidget.vue';

function makeProps(
  overrides: {
    text?: string;
    textAlignment?: number;
    titleRenderMode?: number;
    displayName?: string;
    title?: string;
  } = {},
) {
  return {
    data: {
      name: 'test',
      active: true,
      text: overrides.text ?? '<p>Hello world</p>',
      textAlignment: overrides.textAlignment ?? 1,
      titleRenderMode: overrides.titleRenderMode ?? 1,
      ...(overrides.title !== undefined ? { title: overrides.title } : {}),
    },
    config: {
      name: 'test',
      displayName: overrides.displayName ?? 'Title',
      active: true,
      type: 'TextPageWidget',
      size: 'full',
      sortOrder: 0,
    },
    layout: 'full',
  };
}

describe('TextWidget', () => {
  it('renders text via v-html in a .prose div', () => {
    const wrapper = mountComponent(TextWidget, {
      props: makeProps({ text: '<p>Some content</p>' }),
    });
    const prose = wrapper.find('.prose');
    expect(prose.exists()).toBe(true);
    expect(prose.html()).toContain('<p>Some content</p>');
  });

  // ralph-ui: CaWidgetText.vue getHeadingTag() — 0=h1, 1=h2, 2=h3, 3=div
  describe('titleRenderMode (ralph-ui: getHeadingTag)', () => {
    it('renders h1 when titleRenderMode is 0', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ titleRenderMode: 0 }),
      });
      expect(wrapper.find('h1').exists()).toBe(true);
    });

    it('renders h2 when titleRenderMode is 1', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ titleRenderMode: 1 }),
      });
      expect(wrapper.find('h2').exists()).toBe(true);
    });

    it('renders h3 when titleRenderMode is 2', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ titleRenderMode: 2 }),
      });
      expect(wrapper.find('h3').exists()).toBe(true);
    });

    it('renders div when titleRenderMode is 3', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ titleRenderMode: 3 }),
      });
      expect(wrapper.find('h1').exists()).toBe(false);
      expect(wrapper.find('h2').exists()).toBe(false);
      expect(wrapper.find('h3').exists()).toBe(false);
      const headingDiv = wrapper.find('.font-bold');
      expect(headingDiv.exists()).toBe(true);
      expect(headingDiv.element.tagName).toBe('DIV');
    });

    it('renders div when titleRenderMode is undefined', () => {
      const props = makeProps();
      delete (props.data as Record<string, unknown>).titleRenderMode;
      const wrapper = mountComponent(TextWidget, { props });
      const headingDiv = wrapper.find('.font-bold');
      expect(headingDiv.exists()).toBe(true);
      expect(headingDiv.element.tagName).toBe('DIV');
    });
  });

  // ralph-ui: CaWidgetText.vue textAlignmentClass() — 1=left, 2=center, 3=right, 4=justify, 0=none
  describe('textAlignment (ralph-ui: textAlignmentClass)', () => {
    it('applies text-left for 1', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ textAlignment: 1 }),
      });
      expect(wrapper.find('.text-left').exists()).toBe(true);
    });

    it('applies text-center for 2', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ textAlignment: 2 }),
      });
      expect(wrapper.find('.text-center').exists()).toBe(true);
    });

    it('applies text-right for 3', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ textAlignment: 3 }),
      });
      expect(wrapper.find('.text-right').exists()).toBe(true);
    });

    it('applies text-justify for 4', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ textAlignment: 4 }),
      });
      expect(wrapper.find('.text-justify').exists()).toBe(true);
    });

    it('applies no alignment class for 0 (default)', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ textAlignment: 0 }),
      });
      expect(wrapper.find('.text-left').exists()).toBe(false);
      expect(wrapper.find('.text-center').exists()).toBe(false);
      expect(wrapper.find('.text-right').exists()).toBe(false);
    });
  });

  // ralph-ui: CaWidgetText.vue uses configuration.title, not displayName
  describe('title resolution (ralph-ui: configuration.title)', () => {
    it('prefers data.title over config.displayName', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ title: 'Data Title', displayName: 'Config Name' }),
      });
      expect(wrapper.find('h2').text()).toBe('Data Title');
    });

    it('falls back to config.displayName when data.title is missing', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ displayName: 'My Heading' }),
      });
      expect(wrapper.find('h2').text()).toBe('My Heading');
    });

    it('does not render heading when both title and displayName are empty', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ title: '', displayName: '' }),
      });
      expect(wrapper.find('.font-bold').exists()).toBe(false);
    });
  });

  it('does not render prose div when text is empty', () => {
    const wrapper = mountComponent(TextWidget, {
      props: makeProps({ text: '' }),
    });
    expect(wrapper.find('.prose').exists()).toBe(false);
  });
});

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
      title: overrides.title ?? 'Title',
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
  it('renders text via v-html in a .rich-text div', () => {
    const wrapper = mountComponent(TextWidget, {
      props: makeProps({ text: '<p>Some content</p>' }),
    });
    const prose = wrapper.find('.rich-text');
    expect(prose.exists()).toBe(true);
    expect(prose.html()).toContain('<p>Some content</p>');
  });

  // Geins CMS field: titleRenderMode — 0=h1, 1=h2, 2=h3, 3=div
  describe('titleRenderMode (heading tag)', () => {
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

  // Geins CMS field: textAlignment — 1=left, 2=center, 3=right, 4=justify, 0=none
  describe('textAlignment (alignment class)', () => {
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

  // The heading renders only an explicitly authored data.title. config.displayName
  // is the widget TYPE name (e.g. "Rich text") and must never leak as a heading.
  describe('title resolution', () => {
    it('renders data.title as the heading', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ title: 'Data Title', displayName: 'Config Name' }),
      });
      expect(wrapper.find('h2').text()).toBe('Data Title');
    });

    it('does not fall back to config.displayName (widget type name must not leak)', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ title: '', displayName: 'Rich text' }),
      });
      expect(wrapper.find('.font-bold').exists()).toBe(false);
    });

    it('does not render a heading when no title is authored', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ title: '', displayName: '' }),
      });
      expect(wrapper.find('.font-bold').exists()).toBe(false);
    });
  });

  it('does not render rich-text div when text is empty', () => {
    const wrapper = mountComponent(TextWidget, {
      props: makeProps({ text: '' }),
    });
    expect(wrapper.find('.rich-text').exists()).toBe(false);
  });

  // Line break preservation for plain-text shape from Geins admin
  describe('line break handling', () => {
    it('converts \\n in plain text to <br /> tags', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ text: 'line one\nline two\nline three' }),
      });
      const html = wrapper.html();
      const brCount = (html.match(/<br/g) ?? []).length;
      expect(brCount).toBe(2);
      const text = wrapper.find('.rich-text').text();
      expect(text).toContain('line one');
      expect(text).toContain('line two');
      expect(text).toContain('line three');
    });

    it('leaves HTML input with <p> tags unchanged', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ text: '<p>first</p><p>second</p>' }),
      });
      const html = wrapper.find('.rich-text').html();
      const pCount = (html.match(/<p>/g) ?? []).length;
      const brCount = (html.match(/<br/g) ?? []).length;
      expect(pCount).toBe(2);
      expect(brCount).toBe(0);
    });

    it('normalizes \\r\\n line endings to <br /> tags', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ text: 'a\r\nb\r\nc' }),
      });
      const html = wrapper.html();
      const brCount = (html.match(/<br/g) ?? []).length;
      expect(brCount).toBe(2);
    });

    it('does not render the rich-text div when text is empty', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({ text: '' }),
      });
      expect(wrapper.find('.rich-text').exists()).toBe(false);
    });

    it('renders heading and line breaks together', () => {
      const wrapper = mountComponent(TextWidget, {
        props: makeProps({
          title: 'Hello',
          titleRenderMode: 1,
          text: 'line\nbreak',
        }),
      });
      expect(wrapper.find('h2').exists()).toBe(true);
      expect(wrapper.find('h2').text()).toBe('Hello');
      expect(wrapper.html()).toContain('<br');
    });
  });
});

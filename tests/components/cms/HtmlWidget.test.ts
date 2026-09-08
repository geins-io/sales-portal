import { describe, it, expect, vi } from 'vitest';
import { mountComponent } from '../../utils/component';
import HtmlWidget from '../../../app/components/cms/widgets/HtmlWidget.vue';

vi.mock('#app/composables/head', () => ({
  useHead: vi.fn(),
  useHeadSafe: vi.fn(),
  useServerHead: vi.fn(),
  useServerHeadSafe: vi.fn(),
  useSeoMeta: vi.fn(),
  useServerSeoMeta: vi.fn(),
  injectHead: vi.fn(),
}));
vi.stubGlobal('useHead', vi.fn());

describe('HtmlWidget', () => {
  const defaultProps = {
    data: { name: 'html', active: true, html: '<p>Hello world</p>', css: '' },
    config: {} as never,
    layout: 'default',
  };

  it('renders with a wrapper div', () => {
    const wrapper = mountComponent(HtmlWidget, {
      props: defaultProps,
    });
    expect(wrapper.find('div').exists()).toBe(true);
  });

  it('renders sanitized HTML content', () => {
    const wrapper = mountComponent(HtmlWidget, {
      props: {
        ...defaultProps,
        data: {
          name: 'html',
          active: true,
          html: '<p class="test">Some content</p>',
          css: '',
        },
      },
    });
    expect(wrapper.find('.rich-text').exists()).toBe(true);
    expect(wrapper.html()).toContain('Some content');
  });

  it('handles empty content by not rendering rich-text div', () => {
    const wrapper = mountComponent(HtmlWidget, {
      props: {
        ...defaultProps,
        data: { name: 'html', active: true, html: '', css: '' },
      },
    });
    expect(wrapper.find('.rich-text').exists()).toBe(false);
  });

  it('renders HTML when html property is provided', () => {
    const wrapper = mountComponent(HtmlWidget, {
      props: {
        ...defaultProps,
        data: {
          name: 'html',
          active: true,
          html: '<strong>Bold text</strong>',
          css: '',
        },
      },
    });
    expect(wrapper.find('.rich-text').exists()).toBe(true);
    expect(wrapper.html()).toContain('<strong>Bold text</strong>');
  });
});

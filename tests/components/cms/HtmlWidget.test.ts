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
    data: { html: '<p>Hello world</p>', css: '' },
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
        data: { html: '<p class="test">Some content</p>', css: '' },
      },
    });
    expect(wrapper.find('.prose').exists()).toBe(true);
    expect(wrapper.html()).toContain('Some content');
  });

  it('handles empty content by not rendering prose div', () => {
    const wrapper = mountComponent(HtmlWidget, {
      props: {
        ...defaultProps,
        data: { html: '', css: '' },
      },
    });
    expect(wrapper.find('.prose').exists()).toBe(false);
  });

  it('renders HTML when html property is provided', () => {
    const wrapper = mountComponent(HtmlWidget, {
      props: {
        ...defaultProps,
        data: { html: '<strong>Bold text</strong>', css: '' },
      },
    });
    expect(wrapper.find('.prose').exists()).toBe(true);
    expect(wrapper.html()).toContain('<strong>Bold text</strong>');
  });
});

import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import ImageWidget from '../../../app/components/cms/widgets/ImageWidget.vue';

const geinsImageStub = {
  template:
    '<div class="geins-image" :data-file="fileName" :data-type="type" />',
  props: ['fileName', 'type', 'alt'],
};

const stubs = {
  GeinsImage: geinsImageStub,
  SharedGeinsImage: geinsImageStub,
};

function makeProps(href?: string) {
  return {
    data: {
      name: 'test',
      active: true,
      image: {
        filename: 'banner.jpg',
        ...(href ? { href } : {}),
      },
    },
    config: {
      name: 'test',
      displayName: 'Test Image',
      active: true,
      type: 'ImagePageWidget',
      size: 'full',
      sortOrder: 0,
    },
    layout: 'full',
  };
}

describe('ImageWidget', () => {
  it('renders GeinsImage with correct fileName and type', () => {
    const wrapper = mountComponent(ImageWidget, {
      props: makeProps(),
      global: { stubs },
    });
    const img = wrapper.find('.geins-image');
    expect(img.exists()).toBe(true);
    expect(img.attributes('data-file')).toBe('banner.jpg');
    expect(img.attributes('data-type')).toBe('cms');
  });

  it('wraps in NuxtLink when href exists', () => {
    const wrapper = mountComponent(ImageWidget, {
      props: makeProps('/some-page'),
      global: { stubs },
    });
    const link = wrapper.find('a');
    expect(link.exists()).toBe(true);
  });

  it('does not wrap in NuxtLink when href is missing', () => {
    const wrapper = mountComponent(ImageWidget, {
      props: makeProps(),
      global: { stubs },
    });
    // Should render as a div, not an anchor
    expect(wrapper.find('a').exists()).toBe(false);
    expect(wrapper.find('div.geins-image').exists()).toBe(true);
  });

  it('does not render GeinsImage when filename is missing', () => {
    const wrapper = mountComponent(ImageWidget, {
      props: {
        data: {
          name: 'test',
          active: true,
          image: { filename: '' },
        },
        config: {
          name: 'test',
          displayName: '',
          active: true,
          type: 'ImagePageWidget',
          size: 'full',
          sortOrder: 0,
        },
        layout: 'full',
      },
      global: { stubs },
    });
    expect(wrapper.find('.geins-image').exists()).toBe(false);
  });
});

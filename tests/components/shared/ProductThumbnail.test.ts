import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import { defineComponent, h, type VNode } from 'vue';
import ProductThumbnail from '../../../app/components/shared/ProductThumbnail.vue';

const stubs = {
  GeinsImage: {
    props: ['fileName', 'type', 'alt', 'aspectRatio', 'sizes'],
    template:
      '<img data-testid="geins-image" :data-file-name="fileName" :data-type="type" :alt="alt" />',
  },
  Icon: defineComponent({
    name: 'Icon',
    props: { name: { type: String, default: '' } },
    setup(props): () => VNode {
      return () => h('span', { class: 'icon', 'data-name': props.name });
    },
  }),
  NuxtIcon: defineComponent({
    name: 'NuxtIcon',
    props: { name: { type: String, default: '' } },
    setup(props): () => VNode {
      return () => h('span', { class: 'icon', 'data-name': props.name });
    },
  }),
};

describe('ProductThumbnail', () => {
  it('renders GeinsImage when fileName is provided', () => {
    const w = mount(ProductThumbnail, {
      props: { fileName: 'shoe.png', alt: 'Shoe' },
      global: { stubs },
    });
    const img = w.find('[data-testid="geins-image"]');
    expect(img.exists()).toBe(true);
    expect(img.attributes('data-file-name')).toBe('shoe.png');
    expect(img.attributes('data-type')).toBe('product');
    expect(img.attributes('alt')).toBe('Shoe');
  });

  it('renders placeholder icon when fileName is empty', () => {
    const w = mount(ProductThumbnail, {
      props: { fileName: '', alt: 'x' },
      global: { stubs },
    });
    expect(w.find('[data-testid="geins-image"]').exists()).toBe(false);
    expect(w.find('[data-name="lucide:image-off"]').exists()).toBe(true);
  });

  it('renders placeholder icon when fileName is null', () => {
    const w = mount(ProductThumbnail, {
      props: { fileName: null, alt: 'x' },
      global: { stubs },
    });
    expect(w.find('[data-testid="geins-image"]').exists()).toBe(false);
    expect(w.find('[data-name="lucide:image-off"]').exists()).toBe(true);
  });

  it('applies the default size-10 class when size prop omitted', () => {
    const w = mount(ProductThumbnail, {
      props: { fileName: 'x.png', alt: 'x' },
      global: { stubs },
    });
    expect(w.find('.size-10').exists()).toBe(true);
  });

  it('applies a custom size class when passed', () => {
    const w = mount(ProductThumbnail, {
      props: { fileName: 'x.png', alt: 'x', size: 'size-12' },
      global: { stubs },
    });
    expect(w.find('.size-12').exists()).toBe(true);
    expect(w.find('.size-10').exists()).toBe(false);
  });

  it('applies the default rounded class when radius prop omitted', () => {
    const w = mount(ProductThumbnail, {
      props: { fileName: 'x.png', alt: 'x' },
      global: { stubs },
    });
    expect(w.classes()).toContain('rounded');
  });

  it('applies a custom radius class when passed', () => {
    const w = mount(ProductThumbnail, {
      props: { fileName: 'x.png', alt: 'x', radius: 'rounded-md' },
      global: { stubs },
    });
    expect(w.classes()).toContain('rounded-md');
  });
});

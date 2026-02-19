import { describe, it, expect } from 'vitest';
import { mountComponent } from '../utils/component';
import GeinsImage from '../../app/components/shared/GeinsImage.vue';

const BASE = 'https://monitor.commerce.services';

const iconStub = {
  template: '<span class="icon" :data-name="name"></span>',
  props: ['name'],
};

const nuxtImgStub = {
  template:
    '<img :src="src" :alt="alt" :loading="loading" :sizes="sizes" v-bind="$attrs" />',
  props: ['src', 'alt', 'loading', 'sizes'],
};

const stubs = {
  Icon: iconStub,
  NuxtIcon: iconStub,
  NuxtImg: nuxtImgStub,
};

describe('GeinsImage Component', () => {
  it('renders NuxtImg with raw CDN URL', () => {
    const wrapper = mountComponent(GeinsImage, {
      props: {
        fileName: 'shoe.jpg',
        type: 'product',
        alt: 'A shoe',
      },
      global: { stubs },
    });

    const img = wrapper.find('img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe(`${BASE}/product/raw/shoe.jpg`);
    expect(img.attributes('alt')).toBe('A shoe');
  });

  it('applies loading="lazy" by default', () => {
    const wrapper = mountComponent(GeinsImage, {
      props: { fileName: 'img.jpg', type: 'cms', alt: 'test' },
      global: { stubs },
    });

    expect(wrapper.find('img').attributes('loading')).toBe('lazy');
  });

  it('passes sizes attribute through', () => {
    const wrapper = mountComponent(GeinsImage, {
      props: {
        fileName: 'img.jpg',
        type: 'product',
        alt: 'test',
        sizes: '(max-width: 768px) 100vw, 50vw',
      },
      global: { stubs },
    });

    expect(wrapper.find('img').attributes('sizes')).toBe(
      '(max-width: 768px) 100vw, 50vw',
    );
  });

  it('uses src override when provided', () => {
    const wrapper = mountComponent(GeinsImage, {
      props: {
        fileName: 'ignored.jpg',
        type: 'product',
        alt: 'test',
        src: '/custom/path.jpg',
      },
      global: { stubs },
    });

    expect(wrapper.find('img').attributes('src')).toBe('/custom/path.jpg');
  });

  it('applies aspect-ratio style when prop is set', () => {
    const wrapper = mountComponent(GeinsImage, {
      props: {
        fileName: 'img.jpg',
        type: 'product',
        alt: 'test',
        aspectRatio: '1/1',
      },
      global: { stubs },
    });

    const container = wrapper.find('div');
    expect(container.attributes('style')).toContain('aspect-ratio: 1 / 1');
  });

  it('shows skeleton placeholder initially', () => {
    const wrapper = mountComponent(GeinsImage, {
      props: { fileName: 'img.jpg', type: 'product', alt: 'test' },
      global: { stubs },
    });

    expect(wrapper.find('.animate-pulse').exists()).toBe(true);
  });

  it('shows error fallback on image error', async () => {
    const wrapper = mountComponent(GeinsImage, {
      props: { fileName: 'broken.jpg', type: 'product', alt: 'test' },
      global: { stubs },
    });

    await wrapper.find('img').trigger('error');

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('.icon[data-name="lucide:image-off"]').exists()).toBe(
      true,
    );
  });

  it('hides skeleton after image loads', async () => {
    const wrapper = mountComponent(GeinsImage, {
      props: { fileName: 'img.jpg', type: 'product', alt: 'test' },
      global: { stubs },
    });

    await wrapper.find('img').trigger('load');

    expect(wrapper.find('.animate-pulse').exists()).toBe(false);
  });
});

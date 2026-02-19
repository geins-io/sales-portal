import { describe, it, expect } from 'vitest';
import { mountComponent } from '../utils/component';
import GeinsImage from '../../app/components/shared/GeinsImage.vue';

const BASE = 'https://monitor.commerce.services';

const iconStub = {
  template: '<span class="icon" :data-name="name"></span>',
  props: ['name'],
};

const stubs = {
  // @nuxt/icon can resolve as either name
  Icon: iconStub,
  NuxtIcon: iconStub,
};

describe('GeinsImage Component', () => {
  it('renders an img with correct src for product type', () => {
    const wrapper = mountComponent(GeinsImage, {
      props: {
        fileName: 'shoe.jpg',
        type: 'product',
        alt: 'A shoe',
      },
    });

    const img = wrapper.find('img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe(`${BASE}/product/800x800/shoe.jpg`);
    expect(img.attributes('alt')).toBe('A shoe');
  });

  it('generates srcset from size registry', () => {
    const wrapper = mountComponent(GeinsImage, {
      props: {
        fileName: 'shoe.jpg',
        type: 'product',
        alt: 'A shoe',
      },
    });

    const srcset = wrapper.find('img').attributes('srcset');
    expect(srcset).toContain('100x100/shoe.jpg 100w');
    expect(srcset).toContain('250x250/shoe.jpg 250w');
    expect(srcset).toContain('400x400/shoe.jpg 400w');
    expect(srcset).toContain('800x800/shoe.jpg 800w');
  });

  it('applies loading="lazy" by default', () => {
    const wrapper = mountComponent(GeinsImage, {
      props: { fileName: 'img.jpg', type: 'cms', alt: 'test' },
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
    });

    const img = wrapper.find('img');
    expect(img.attributes('src')).toBe('/custom/path.jpg');
    expect(img.attributes('srcset')).toBeUndefined();
  });

  it('applies aspect-ratio style when prop is set', () => {
    const wrapper = mountComponent(GeinsImage, {
      props: {
        fileName: 'img.jpg',
        type: 'product',
        alt: 'test',
        aspectRatio: '1/1',
      },
    });

    const container = wrapper.find('div');
    expect(container.attributes('style')).toContain('aspect-ratio: 1 / 1');
  });

  it('shows skeleton placeholder initially', () => {
    const wrapper = mountComponent(GeinsImage, {
      props: { fileName: 'img.jpg', type: 'product', alt: 'test' },
    });

    const skeleton = wrapper.find('.animate-pulse');
    expect(skeleton.exists()).toBe(true);
  });

  it('shows error fallback on image error', async () => {
    const wrapper = mountComponent(GeinsImage, {
      props: { fileName: 'broken.jpg', type: 'product', alt: 'test' },
      global: { stubs },
    });

    await wrapper.find('img').trigger('error');

    // After error, img is removed and error container is shown
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('.icon[data-name="lucide:image-off"]').exists()).toBe(
      true,
    );
  });

  it('hides skeleton after image loads', async () => {
    const wrapper = mountComponent(GeinsImage, {
      props: { fileName: 'img.jpg', type: 'product', alt: 'test' },
    });

    await wrapper.find('img').trigger('load');

    expect(wrapper.find('.animate-pulse').exists()).toBe(false);
  });
});

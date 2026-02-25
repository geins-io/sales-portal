import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import ProductGallery from '../../../app/components/product/ProductGallery.vue';
import { Dialog, DialogContent } from '../../../app/components/ui/dialog';

const geinsImageStub = {
  template: '<div class="geins-image" />',
  props: ['fileName', 'type', 'alt', 'loading'],
};

const iconStub = {
  template: '<span class="icon" :data-name="name" />',
  props: ['name'],
};

const stubs: Record<string, unknown> = {
  GeinsImage: geinsImageStub,
  SharedGeinsImage: geinsImageStub,
  Icon: iconStub,
  NuxtIcon: iconStub,
  [Dialog.__name ?? 'Dialog']: {
    template: '<div class="dialog"><slot /></div>',
    props: ['open'],
  },
  [DialogContent.__name ?? 'DialogContent']: {
    template: '<div class="dialog-content"><slot /></div>',
    props: ['class'],
  },
};

function makeImages(count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    fileName: `product-${i + 1}.jpg`,
  }));
}

describe('ProductGallery', () => {
  it('renders main image with first image', () => {
    const wrapper = mountComponent(ProductGallery, {
      props: { images: makeImages(), productName: 'Test Product' },
      global: { stubs },
    });
    const images = wrapper.findAll('.geins-image');
    expect(images.length).toBeGreaterThanOrEqual(1);
  });

  it('shows thumbnails for multiple images', () => {
    const wrapper = mountComponent(ProductGallery, {
      props: { images: makeImages(3), productName: 'Test Product' },
      global: { stubs },
    });
    const thumbnails = wrapper.find('[data-testid="thumbnails"]');
    expect(thumbnails.exists()).toBe(true);
    // 3 thumbnail buttons
    const thumbButtons = thumbnails.findAll('button');
    expect(thumbButtons.length).toBe(3);
  });

  it('hides thumbnails for single image', () => {
    const wrapper = mountComponent(ProductGallery, {
      props: { images: makeImages(1), productName: 'Test Product' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="thumbnails"]').exists()).toBe(false);
  });

  it('click thumbnail changes selected index', async () => {
    const wrapper = mountComponent(ProductGallery, {
      props: { images: makeImages(3), productName: 'Test Product' },
      global: { stubs },
    });
    const thumbnails = wrapper.find('[data-testid="thumbnails"]');
    const thumbButtons = thumbnails.findAll('button');

    // Second thumbnail should not have ring initially
    expect(thumbButtons[1]!.classes()).toContain('opacity-70');

    await thumbButtons[1]!.trigger('click');

    // After click, second thumbnail should have ring
    expect(thumbButtons[1]!.classes()).toContain('ring-primary');
  });

  it('shows image counter for multiple images', () => {
    const wrapper = mountComponent(ProductGallery, {
      props: { images: makeImages(3), productName: 'Test Product' },
      global: { stubs },
    });
    const counter = wrapper.find('[data-testid="image-counter"]');
    expect(counter.exists()).toBe(true);
    expect(counter.text()).toContain('Image 1 of 3');
  });

  it('hides image counter for single image', () => {
    const wrapper = mountComponent(ProductGallery, {
      props: { images: makeImages(1), productName: 'Test Product' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="image-counter"]').exists()).toBe(false);
  });

  it('updates image counter on thumbnail click', async () => {
    const wrapper = mountComponent(ProductGallery, {
      props: { images: makeImages(3), productName: 'Test Product' },
      global: { stubs },
    });
    const thumbnails = wrapper.find('[data-testid="thumbnails"]');
    const thumbButtons = thumbnails.findAll('button');

    await thumbButtons[1]!.trigger('click');

    const counter = wrapper.find('[data-testid="image-counter"]');
    expect(counter.text()).toContain('Image 2 of 3');
  });
});

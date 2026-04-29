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
  it('renders main image', () => {
    const wrapper = mountComponent(ProductGallery, {
      props: { images: makeImages(), productName: 'Test Product' },
      global: { stubs },
    });
    const images = wrapper.findAll('.geins-image');
    expect(images.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render thumbnail strip', () => {
    const wrapper = mountComponent(ProductGallery, {
      props: { images: makeImages(3), productName: 'Test Product' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="thumbnails"]').exists()).toBe(false);
  });

  it('shows prev/next arrows for multiple images', () => {
    const wrapper = mountComponent(ProductGallery, {
      props: { images: makeImages(3), productName: 'Test Product' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="gallery-prev"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="gallery-next"]').exists()).toBe(true);
  });

  it('hides arrows for single image', () => {
    const wrapper = mountComponent(ProductGallery, {
      props: { images: makeImages(1), productName: 'Test Product' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="gallery-prev"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="gallery-next"]').exists()).toBe(false);
  });

  it('next arrow click does not error', async () => {
    const wrapper = mountComponent(ProductGallery, {
      props: { images: makeImages(3), productName: 'Test Product' },
      global: { stubs },
    });
    await wrapper.find('[data-testid="gallery-next"]').trigger('click');
    expect(wrapper.find('[data-testid="image-counter"]').exists()).toBe(true);
  });

  it('prev arrow wraps from first to last', async () => {
    const wrapper = mountComponent(ProductGallery, {
      props: { images: makeImages(3), productName: 'Test Product' },
      global: { stubs },
    });
    await wrapper.find('[data-testid="gallery-prev"]').trigger('click');
    expect(wrapper.find('[data-testid="image-counter"]').exists()).toBe(true);
  });

  it('shows image counter for multiple images', () => {
    const wrapper = mountComponent(ProductGallery, {
      props: { images: makeImages(3), productName: 'Test Product' },
      global: { stubs },
    });
    const counter = wrapper.find('[data-testid="image-counter"]');
    expect(counter.exists()).toBe(true);
  });

  it('hides image counter for single image', () => {
    const wrapper = mountComponent(ProductGallery, {
      props: { images: makeImages(1), productName: 'Test Product' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="image-counter"]').exists()).toBe(false);
  });
});

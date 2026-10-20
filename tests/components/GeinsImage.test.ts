import { describe, it, expect, afterEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { useHead } from '#app/composables/head';
import type { Ref } from 'vue';
import { mountComponent } from '../utils/component';
import { mockAssetBaseUrl } from '../setup-components';
import GeinsImage from '../../app/components/shared/GeinsImage.vue';

const BASE = 'https://monitor.commerce.services';
const LIBRARY = 'https://cdn.example.test/acme/products/shoe.jpg';

const iconStub = {
  template: '<span class="icon" :data-name="name"></span>',
  props: ['name'],
};

const stubs = {
  Icon: iconStub,
  NuxtIcon: iconStub,
};

function mountImage(props: Record<string, unknown>) {
  return mountComponent(GeinsImage, {
    props: { type: 'product', alt: 'test', ...props },
    global: { stubs },
  });
}

/**
 * Makes every <img> report the given state, as a browser would: whether it
 * finished, its intrinsic width, and whether decoding it succeeds.
 */
function imagesReport(state: {
  complete: boolean;
  naturalWidth: number;
  decodes: boolean;
}) {
  const proto = HTMLImageElement.prototype;
  const saved = (['complete', 'naturalWidth', 'decode'] as const).map(
    (key) => [key, Object.getOwnPropertyDescriptor(proto, key)] as const,
  );
  const decode = vi.fn(() =>
    state.decodes
      ? Promise.resolve()
      : Promise.reject(new DOMException('broken', 'EncodingError')),
  );
  Object.defineProperty(proto, 'complete', {
    configurable: true,
    get: () => state.complete,
  });
  Object.defineProperty(proto, 'naturalWidth', {
    configurable: true,
    get: () => state.naturalWidth,
  });
  Object.defineProperty(proto, 'decode', { configurable: true, value: decode });
  const restore = () => {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(proto, key, descriptor);
      else Reflect.deleteProperty(proto, key);
    }
  };
  return { restore, decode };
}

type HeadLink = Record<string, string | undefined>;

/** The links the image put in the head, as the page would render them. */
function headLinks(): HeadLink[] {
  return vi
    .mocked(useHead)
    .mock.calls.flatMap(
      ([input]) => (input as { link?: Ref<HeadLink[]> }).link?.value ?? [],
    );
}

describe('GeinsImage Component', () => {
  let restore: (() => void) | undefined;

  afterEach(() => {
    vi.mocked(useHead).mockClear();
    mockAssetBaseUrl.value = '';
    restore?.();
    restore = undefined;
  });

  describe('a legacy image', () => {
    it('renders the raw CDN URL with no width candidates', () => {
      const img = mountImage({ fileName: 'shoe.jpg', alt: 'A shoe' }).find(
        'img',
      );

      expect(img.attributes('src')).toBe(`${BASE}/product/raw/shoe.jpg`);
      expect(img.attributes('alt')).toBe('A shoe');
      expect(img.attributes('srcset')).toBeUndefined();
      expect(img.attributes('sizes')).toBeUndefined();
    });

    it('falls back to the raw file when the url is null', () => {
      const img = mountImage({ fileName: 'shoe.jpg', url: null }).find('img');

      expect(img.attributes('src')).toBe(`${BASE}/product/raw/shoe.jpg`);
    });
  });

  describe('a library image', () => {
    it('renders every ladder width and lets sizes pick one', () => {
      const img = mountImage({
        fileName: 'shoe.jpg',
        url: LIBRARY,
        sizes: '(min-width: 768px) 400px, 100vw',
      }).find('img');

      expect(img.attributes('src')).toBe(`${LIBRARY}?width=2560&format=auto`);
      expect(img.attributes('srcset')).toContain(
        `${LIBRARY}?width=160&format=auto 160w`,
      );
      expect(img.attributes('srcset')).toContain(
        `${LIBRARY}?width=2560&format=auto 2560w`,
      );
      expect(img.attributes('sizes')).toBe('(min-width: 768px) 400px, 100vw');
    });

    it('defaults sizes to the full viewport width', () => {
      const img = mountImage({ url: LIBRARY }).find('img');

      expect(img.attributes('sizes')).toBe('100vw');
    });

    it('takes a ladder of its own', () => {
      const img = mountImage({ url: LIBRARY, widths: [80, 160] }).find('img');

      expect(img.attributes('srcset')).toBe(
        `${LIBRARY}?width=80&format=auto 80w, ${LIBRARY}?width=160&format=auto 160w`,
      );
    });

    it('resolves a CMS path against the account base', () => {
      mockAssetBaseUrl.value = 'https://cdn.example.test/acme';
      const img = mountImage({
        type: 'pagewidget',
        fileName: 'banner4.jpg',
        path: 'content/banner4.jpg',
      }).find('img');

      expect(img.attributes('src')).toBe(
        'https://cdn.example.test/acme/content/banner4.jpg?width=2560&format=auto',
      );
    });

    it('keeps a CMS path on the legacy file while the account has no base', () => {
      const img = mountImage({
        type: 'pagewidget',
        fileName: 'banner4.jpg',
        path: 'content/banner4.jpg',
      }).find('img');

      expect(img.attributes('src')).toBe(`${BASE}/pagewidget/raw/banner4.jpg`);
    });
  });

  it('renders nothing without a source', () => {
    expect(mountImage({ fileName: null }).find('img').exists()).toBe(false);
    expect(mountImage({ fileName: '' }).find('img').exists()).toBe(false);
  });

  it('applies loading="lazy" by default, and decodes off the main thread', () => {
    const img = mountImage({ fileName: 'img.jpg' }).find('img');

    expect(img.attributes('loading')).toBe('lazy');
    expect(img.attributes('decoding')).toBe('async');
  });

  it('passes loading="eager" through', () => {
    const img = mountImage({ fileName: 'img.jpg', loading: 'eager' }).find(
      'img',
    );

    expect(img.attributes('loading')).toBe('eager');
  });

  it('uses src override when provided', () => {
    const img = mountImage({
      fileName: 'ignored.jpg',
      url: LIBRARY,
      src: '/custom/path.jpg',
    }).find('img');

    expect(img.attributes('src')).toBe('/custom/path.jpg');
    expect(img.attributes('srcset')).toBeUndefined();
  });

  describe('a box of fixed ratio (aspectRatio)', () => {
    it('shapes the box and the CDN request from the same value', () => {
      const wrapper = mountImage({
        url: LIBRARY,
        aspectRatio: '16/9',
        widths: [160, 1200],
      });

      expect(wrapper.find('div').element.style.aspectRatio).toBe(
        `${16 / 9} / 1`,
      );
      expect(wrapper.find('img').attributes('srcset')).toBe(
        `${LIBRARY}?width=160&height=90&fit=crop&format=auto 160w, ${LIBRARY}?width=1200&height=675&fit=crop&format=auto 1200w`,
      );
      expect(wrapper.find('img').attributes('src')).toBe(
        `${LIBRARY}?width=1200&height=675&fit=crop&format=auto`,
      );
    });

    it.each(['contain', 'natural'])(
      'asks for width only when the image does not crop (fit=%s)',
      (fit) => {
        const img = mountImage({
          url: LIBRARY,
          aspectRatio: '1',
          fit,
          widths: [160],
        }).find('img');

        expect(img.attributes('srcset')).toBe(
          `${LIBRARY}?width=160&format=auto 160w`,
        );
      },
    );

    it('leaves the box unstyled and asks for width only without a ratio', () => {
      const wrapper = mountImage({ url: LIBRARY, widths: [160] });

      expect(wrapper.find('div').attributes('style')).toBeUndefined();
      expect(wrapper.find('img').attributes('srcset')).toBe(
        `${LIBRARY}?width=160&format=auto 160w`,
      );
    });

    it('serves a legacy image raw, in the shaped box', () => {
      const wrapper = mountImage({ fileName: 'shoe.jpg', aspectRatio: '1' });

      expect(wrapper.find('div').element.style.aspectRatio).toBe('1 / 1');
      expect(wrapper.find('img').attributes('src')).toBe(
        `${BASE}/product/raw/shoe.jpg`,
      );
      expect(wrapper.find('img').attributes('srcset')).toBeUndefined();
    });

    it('preloads the cropped candidates the img carries', () => {
      const img = mountImage({
        url: LIBRARY,
        aspectRatio: '1',
        priority: true,
      }).find('img');

      expect(headLinks()[1]).toMatchObject({
        href: img.attributes('src'),
        imagesrcset: img.attributes('srcset'),
      });
      expect(img.attributes('srcset')).toContain('fit=crop');
    });
  });

  describe('a box of fixed height (coverHeight)', () => {
    it('picks a source per viewport range, each covering the box', () => {
      const wrapper = mountImage({ url: LIBRARY, coverHeight: 400 });
      const sources = wrapper.findAll('picture > source');
      const img = wrapper.find('picture > img');

      expect(sources.map((s) => s.attributes('media'))).toEqual([
        '(max-width: 767px)',
        '(min-width: 768px) and (max-width: 1023px)',
        '(min-width: 1024px) and (max-width: 1279px)',
        '(min-width: 1280px)',
      ]);
      expect(sources[0]!.attributes('srcset')).toContain(
        `${LIBRARY}?width=2304&height=1200&fit=cover&format=auto 3x`,
      );
      expect(img.attributes('src')).toBe(
        `${LIBRARY}?width=1920&height=400&fit=cover&format=auto`,
      );
      expect(img.attributes('srcset')).toBe(sources[3]!.attributes('srcset'));
      expect(img.attributes('sizes')).toBeUndefined();
      expect(img.classes()).toEqual(
        expect.arrayContaining(['size-full', 'object-cover']),
      );
    });

    it('preloads each source for its own range, so only one is fetched', () => {
      const wrapper = mountImage({
        url: LIBRARY,
        coverHeight: 400,
        priority: true,
      });
      const sources = wrapper.findAll('picture > source');
      const preloads = headLinks().filter((l) => l.rel === 'preload');

      expect(preloads).toEqual(
        sources.map((source, i) => ({
          key: `image-preload-${wrapper.find('img').attributes('src')}-${i}`,
          rel: 'preload',
          as: 'image',
          href: wrapper.find('img').attributes('src'),
          media: source.attributes('media'),
          imagesrcset: source.attributes('srcset'),
          fetchpriority: 'high',
        })),
      );
      expect(headLinks()[0]).toMatchObject({ rel: 'preconnect' });
    });

    it('renders a legacy image as a plain img', () => {
      const wrapper = mountImage({ fileName: 'hero.png', coverHeight: 400 });

      expect(wrapper.find('picture').exists()).toBe(false);
      expect(wrapper.find('img').attributes('src')).toBe(
        `${BASE}/product/raw/hero.png`,
      );
    });

    it.each(['contain', 'natural'])(
      'ignores the height when the image does not crop (fit=%s)',
      (fit) => {
        const wrapper = mountImage({ url: LIBRARY, coverHeight: 400, fit });

        expect(wrapper.find('picture').exists()).toBe(false);
        expect(wrapper.find('img').attributes('srcset')).toContain('160w');
      },
    );
  });

  describe('a separate mobile image', () => {
    const MOBILE = 'https://cdn.example.test/acme/content/hero-mobile.png';
    const SIZES = '(min-width: 1440px) 1280px, 100vw';

    it('is a source below 768 px; the desktop image keeps its widths and box above', () => {
      const wrapper = mountImage({
        url: LIBRARY,
        mobile: { url: MOBILE },
        sizes: SIZES,
        fit: 'natural',
      });
      const [mobile, desktop] = wrapper.findAll('picture > source');
      const img = wrapper.find('picture > img');

      expect(mobile!.attributes()).toMatchObject({
        media: '(max-width: 767px)',
        sizes: SIZES,
      });
      expect(mobile!.attributes('srcset')).toContain(
        `${MOBILE}?width=160&format=auto 160w`,
      );
      expect(desktop!.attributes()).toMatchObject({
        media: '(min-width: 768px)',
        srcset: img.attributes('srcset'),
        sizes: SIZES,
      });
      expect(img.attributes('srcset')).toContain(
        `${LIBRARY}?width=160&format=auto 160w`,
      );
      expect(img.attributes('sizes')).toBe(SIZES);
      expect(img.classes()).toEqual(
        expect.arrayContaining(['block', 'h-auto', 'w-full']),
      );
    });

    it('takes the first range of a cover box and leaves the others', () => {
      const plain = mountImage({ url: LIBRARY, coverHeight: 400 });
      const wrapper = mountImage({
        url: LIBRARY,
        coverHeight: 400,
        mobile: { url: MOBILE },
      });
      const sources = wrapper.findAll('picture > source');

      expect(sources[0]!.attributes('srcset')).toContain(
        `${MOBILE}?width=768&height=400&fit=cover&format=auto 1x`,
      );
      expect(sources[0]!.attributes('sizes')).toBeUndefined();
      expect(wrapper.find('picture').html()).not.toBe(
        plain.find('picture').html(),
      );
      expect(sources.slice(1).map((s) => s.html())).toEqual(
        plain
          .findAll('picture > source')
          .slice(1)
          .map((s) => s.html()),
      );
      expect(wrapper.find('img').html()).toBe(plain.find('img').html());
    });

    it('serves a legacy mobile image as its raw file', () => {
      const source = mountImage({
        url: LIBRARY,
        type: 'pagewidget',
        mobile: { fileName: 'hero-mobile.png' },
      }).find('picture > source');

      expect(source.attributes('srcset')).toBe(
        `${BASE}/pagewidget/raw/hero-mobile.png`,
      );
      expect(source.attributes('sizes')).toBeUndefined();
    });

    it.each([null, {}, { url: null, path: null, fileName: '' }])(
      'renders as without one when it locates nothing (%o)',
      (mobile) => {
        const wrapper = mountImage({ url: LIBRARY, mobile });

        expect(wrapper.find('picture').exists()).toBe(false);
        expect(wrapper.html()).toBe(mountImage({ url: LIBRARY }).html());
      },
    );

    it('preloads each image for its own viewports, so only one is fetched', () => {
      const wrapper = mountImage({
        url: LIBRARY,
        mobile: { url: MOBILE },
        sizes: SIZES,
        priority: true,
      });
      const src = wrapper.find('img').attributes('src');
      const preloads = headLinks().filter((l) => l.rel === 'preload');

      expect(preloads).toEqual(
        wrapper.findAll('picture > source').map((source, i) => ({
          key: `image-preload-${src}-${i}`,
          rel: 'preload',
          as: 'image',
          href: expect.stringMatching(
            i === 0
              ? /^https:\/\/cdn\.example\.test\/acme\/content\/hero-mobile\.png\?width=2560/
              : /shoe\.jpg\?width=2560/,
          ),
          media: source.attributes('media'),
          imagesrcset: source.attributes('srcset'),
          imagesizes: SIZES,
          fetchpriority: 'high',
        })),
      );
    });

    it('preloads the mobile range of a cover box from the mobile image', () => {
      mountImage({
        url: LIBRARY,
        coverHeight: 400,
        mobile: { url: MOBILE },
        priority: true,
      });
      const preloads = headLinks().filter((l) => l.rel === 'preload');

      expect(preloads.map((l) => l.href)).toEqual([
        `${MOBILE}?width=768&height=400&fit=cover&format=auto`,
        `${LIBRARY}?width=1920&height=400&fit=cover&format=auto`,
        `${LIBRARY}?width=1920&height=400&fit=cover&format=auto`,
        `${LIBRARY}?width=1920&height=400&fit=cover&format=auto`,
      ]);
    });
  });

  it.each([
    ['cover', ['size-full', 'object-cover']],
    ['contain', ['size-full', 'object-contain']],
    ['natural', ['block', 'h-auto', 'w-full']],
  ])('sizes the img for fit=%s', (fit, classes) => {
    const img = mountImage({ fileName: 'img.jpg', fit }).find('img');

    expect(img.classes()).toEqual(expect.arrayContaining(classes));
  });

  describe('the page’s largest image (priority)', () => {
    it('is fetched first, eagerly, and decoded at once', () => {
      const img = mountImage({ url: LIBRARY, priority: true }).find('img');

      expect(img.attributes('fetchpriority')).toBe('high');
      expect(img.attributes('loading')).toBe('eager');
      expect(img.attributes('decoding')).toBeUndefined();
    });

    it('is preloaded with the same candidates and sizes as the img, and its CDN preconnected', () => {
      const img = mountImage({
        url: LIBRARY,
        priority: true,
        sizes: '(min-width: 768px) 400px, 100vw',
      }).find('img');

      expect(headLinks()).toEqual([
        {
          key: 'image-cdn-preconnect',
          rel: 'preconnect',
          href: 'https://cdn.example.test',
        },
        {
          key: `image-preload-${img.attributes('src')}`,
          rel: 'preload',
          as: 'image',
          href: img.attributes('src'),
          imagesrcset: img.attributes('srcset'),
          imagesizes: img.attributes('sizes'),
          fetchpriority: 'high',
        },
      ]);
    });

    it('preloads a legacy image by its one URL, with nothing to preconnect', () => {
      mountImage({ fileName: 'shoe.jpg', priority: true });

      expect(headLinks()).toEqual([
        {
          key: `image-preload-${BASE}/product/raw/shoe.jpg`,
          rel: 'preload',
          as: 'image',
          href: `${BASE}/product/raw/shoe.jpg`,
          imagesrcset: undefined,
          imagesizes: undefined,
          fetchpriority: 'high',
        },
      ]);
    });

    it('preloads nothing without a source', () => {
      mountImage({ fileName: null, priority: true });

      expect(headLinks()).toEqual([]);
    });

    it('leaves every other image to the browser: no head links, no fetchpriority', () => {
      const img = mountImage({ url: LIBRARY, loading: 'eager' }).find('img');

      expect(headLinks()).toEqual([]);
      expect(img.attributes('fetchpriority')).toBeUndefined();
      expect(img.attributes('loading')).toBe('eager');
    });
  });

  describe('the skeleton', () => {
    it('sits behind the image, so a server-rendered image shows before hydration', () => {
      const wrapper = mountImage({ fileName: 'img.jpg' });
      const skeleton = wrapper.find('.animate-pulse');
      const img = wrapper.find('img');

      expect(skeleton.exists()).toBe(true);
      expect(skeleton.classes()).toContain('absolute');
      // A positioned element later in the box paints over an earlier one.
      expect(img.classes()).toContain('relative');
      expect(
        skeleton.element.compareDocumentPosition(img.element) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('goes when the image loads', async () => {
      const wrapper = mountImage({ fileName: 'img.jpg' });

      await wrapper.find('img').trigger('load');

      expect(wrapper.find('.animate-pulse').exists()).toBe(false);
    });

    it('goes at mount for an image that finished loading before hydration', async () => {
      const report = imagesReport({
        complete: true,
        naturalWidth: 800,
        decodes: true,
      });
      restore = report.restore;
      const wrapper = mountImage({ fileName: 'img.jpg' });
      await flushPromises();

      expect(wrapper.find('.animate-pulse').exists()).toBe(false);
      expect(wrapper.find('img').exists()).toBe(true);
    });

    it('keeps a finished image that reports no intrinsic width but decodes, such as an SVG', async () => {
      const report = imagesReport({
        complete: true,
        naturalWidth: 0,
        decodes: true,
      });
      restore = report.restore;
      const wrapper = mountImage({ fileName: 'logo.svg' });
      await flushPromises();

      expect(wrapper.find('img').exists()).toBe(true);
      expect(wrapper.find('.animate-pulse').exists()).toBe(false);
    });

    it('stays at mount for an image still loading, and leaves it to the load event', async () => {
      const report = imagesReport({
        complete: false,
        naturalWidth: 0,
        decodes: true,
      });
      restore = report.restore;
      const wrapper = mountImage({ fileName: 'img.jpg' });
      await flushPromises();

      expect(wrapper.find('.animate-pulse').exists()).toBe(true);
      expect(report.decode).not.toHaveBeenCalled();
    });

    it('comes back when the image changes', async () => {
      const wrapper = mountImage({ url: LIBRARY });
      await wrapper.find('img').trigger('load');

      await wrapper.setProps({
        url: 'https://cdn.example.test/acme/products/other.jpg',
      });

      expect(wrapper.find('.animate-pulse').exists()).toBe(true);
    });
  });

  describe('the error state', () => {
    it('replaces the image on an error event', async () => {
      const { ImageOff } = await import('lucide-vue-next');
      const wrapper = mountImage({ fileName: 'broken.jpg' });

      await wrapper.find('img').trigger('error');

      expect(wrapper.find('img').exists()).toBe(false);
      expect(wrapper.findComponent(ImageOff).exists()).toBe(true);
    });

    it('shows at mount for an image that failed before hydration', async () => {
      const { ImageOff } = await import('lucide-vue-next');
      const report = imagesReport({
        complete: true,
        naturalWidth: 0,
        decodes: false,
      });
      restore = report.restore;
      const wrapper = mountImage({ fileName: 'broken.jpg' });
      await flushPromises();

      expect(wrapper.find('img').exists()).toBe(false);
      expect(wrapper.findComponent(ImageOff).exists()).toBe(true);
    });

    it('clears when the image changes', async () => {
      const wrapper = mountImage({ fileName: 'broken.jpg' });
      await wrapper.find('img').trigger('error');

      await wrapper.setProps({ fileName: 'fixed.jpg' });

      expect(wrapper.find('img').attributes('src')).toBe(
        `${BASE}/product/raw/fixed.jpg`,
      );
    });
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import { mountComponent } from '../../utils/component';
import { mockAssetBaseUrl } from '../../setup-components';
import ImageWidget from '../../../app/components/cms/widgets/ImageWidget.vue';

const geinsImageStub = {
  template:
    '<div class="geins-image" :data-file="fileName" :data-url="url" :data-type="type" :data-priority="String(priority)" />',
  props: {
    fileName: String,
    url: String,
    path: String,
    type: String,
    alt: String,
    loading: String,
    sizes: String,
    priority: Boolean,
  },
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
  it.each([
    [true, 'true'],
    [false, 'false'],
  ])('passes priority=%s to its image', (priority, expected) => {
    const image = mountComponent(ImageWidget, {
      props: { ...makeProps(), priority },
      global: { stubs },
    }).find('.geins-image');

    expect(image.attributes('data-priority')).toBe(expected);
  });

  it('passes the library url of the image the configuration names', () => {
    const image = mountComponent(ImageWidget, {
      props: {
        ...makeProps(),
        images: [
          {
            fileName: 'banner.jpg',
            url: 'https://cdn.litium.media/acme/content/banner.jpg',
            largestSize: null,
          },
        ],
      },
      global: { stubs },
    }).find('.geins-image');

    expect(image.attributes('data-url')).toBe(
      'https://cdn.litium.media/acme/content/banner.jpg',
    );
  });

  it('passes no library url when the matching image has none', () => {
    const image = mountComponent(ImageWidget, {
      props: {
        ...makeProps(),
        images: [{ fileName: 'banner.jpg', url: null, largestSize: null }],
      },
      global: { stubs },
    }).find('.geins-image');

    expect(image.attributes('data-url')).toBeUndefined();
  });

  it('renders GeinsImage with correct fileName and type', () => {
    const wrapper = mountComponent(ImageWidget, {
      props: makeProps(),
      global: { stubs },
    });
    const img = wrapper.find('.geins-image');
    expect(img.exists()).toBe(true);
    expect(img.attributes('data-file')).toBe('banner.jpg');
    expect(img.attributes('data-type')).toBe('pagewidget');
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

  it('renders the image unlinked when the href has an unsafe scheme', () => {
    const wrapper = mountComponent(ImageWidget, {
      props: makeProps('javascript:alert(1)'),
      global: { stubs },
    });
    expect(wrapper.find('a').exists()).toBe(false);
    expect(wrapper.find('.geins-image').exists()).toBe(true);
  });

  describe('a mobile image', () => {
    const DESKTOP_URL = 'https://cdn.litium.media/acme/content/banner.jpg';
    const MOBILE_URL =
      'https://cdn.litium.media/acme/content/banner-mobile.jpg';

    afterEach(() => {
      mockAssetBaseUrl.value = '';
    });

    /** The widget with its real image, which builds the sources. */
    function mountWithMobile(
      image: Record<string, unknown>,
      images: { fileName: string; url: string | null }[] = [],
    ) {
      const props = makeProps();
      return mountComponent(ImageWidget, {
        props: {
          ...props,
          data: { ...props.data, image: { ...props.data.image, ...image } },
          images: images.map((i) => ({ ...i, largestSize: null })),
        },
      });
    }

    const sources = (wrapper: ReturnType<typeof mountWithMobile>) =>
      Object.fromEntries(
        wrapper
          .findAll('picture > source')
          .map((s) => [s.attributes('media'), s.attributes('srcset')]),
      );

    it('shows a migrated account’s mobile image below 768 px, the desktop one above', () => {
      const wrapper = mountWithMobile(
        { filenameForMobileDevice: 'banner-mobile.jpg' },
        [
          { fileName: 'banner.jpg', url: DESKTOP_URL },
          { fileName: 'banner-mobile.jpg', url: MOBILE_URL },
        ],
      );

      expect(sources(wrapper)['(max-width: 767px)']).toContain(
        `${MOBILE_URL}?width=160&format=auto 160w`,
      );
      expect(sources(wrapper)['(min-width: 768px)']).toContain(
        `${DESKTOP_URL}?width=160&format=auto 160w`,
      );
      expect(wrapper.find('img').attributes('src')).toContain(DESKTOP_URL);
    });

    it('locates a mobile image by its library path on the account host', () => {
      mockAssetBaseUrl.value = 'https://cdn.litium.media/acme';
      const wrapper = mountWithMobile({
        filenameForMobileDevice: 'banner-mobile.jpg',
        pathForMobileDevice: 'content/banner-mobile.jpg',
      });

      expect(sources(wrapper)['(max-width: 767px)']).toContain(
        `${MOBILE_URL}?width=160&format=auto 160w`,
      );
    });

    it('shows a legacy account’s mobile file raw below 768 px', () => {
      const wrapper = mountWithMobile({
        filenameForMobileDevice: 'banner-mobile.jpg',
      });

      expect(sources(wrapper)).toEqual({
        '(max-width: 767px)':
          'https://monitor.commerce.services/pagewidget/raw/banner-mobile.jpg',
        '(min-width: 768px)':
          'https://monitor.commerce.services/pagewidget/raw/banner.jpg',
      });
    });

    it.each([null, undefined])(
      'renders the plain img as before without one (%s)',
      (filenameForMobileDevice) => {
        const wrapper = mountWithMobile(
          { filenameForMobileDevice, pathForMobileDevice: null },
          [{ fileName: 'banner.jpg', url: DESKTOP_URL }],
        );

        expect(wrapper.find('picture').exists()).toBe(false);
        expect(wrapper.find('img').attributes('srcset')).toContain(DESKTOP_URL);
      },
    );
  });
});

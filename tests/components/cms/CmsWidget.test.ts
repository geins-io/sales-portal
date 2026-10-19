import { describe, it, expect, vi } from 'vitest';
import { mountComponent, shallowMountComponent } from '../../utils/component';
import CmsWidget from '../../../app/components/cms/CmsWidget.vue';

const textWidgetStub = {
  template: '<div class="text-widget" />',
  props: ['data', 'config', 'layout'],
};
const htmlWidgetStub = {
  template: '<div class="html-widget" />',
  props: ['data', 'config', 'layout'],
};
const imageWidgetStub = {
  template: '<div class="image-widget" />',
  props: ['data', 'config', 'layout'],
};
const bannerWidgetStub = {
  template: '<div class="banner-widget" />',
  props: ['data', 'config', 'layout'],
};
const buttonsWidgetStub = {
  template: '<div class="buttons-widget" />',
  props: ['data', 'config', 'layout'],
};
const videoWidgetStub = {
  template: '<div class="video-widget" />',
  props: ['data', 'config', 'layout'],
};

const stubs = {
  TextWidget: textWidgetStub,
  CmsWidgetsTextWidget: textWidgetStub,
  HtmlWidget: htmlWidgetStub,
  CmsWidgetsHtmlWidget: htmlWidgetStub,
  ImageWidget: imageWidgetStub,
  CmsWidgetsImageWidget: imageWidgetStub,
  BannerWidget: bannerWidgetStub,
  CmsWidgetsBannerWidget: bannerWidgetStub,
  ButtonsWidget: buttonsWidgetStub,
  CmsWidgetsButtonsWidget: buttonsWidgetStub,
  VideoWidget: videoWidgetStub,
  CmsWidgetsVideoWidget: videoWidgetStub,
};

const imagesProbe = {
  name: 'ImagesProbe',
  template: '<div class="images-probe" />',
  props: ['data', 'config', 'layout', 'collapse', 'priority', 'images'],
};
const imageStubs = {
  ImageWidget: imagesProbe,
  BannerWidget: imagesProbe,
  TextWidget: { ...imagesProbe, props: ['data', 'config', 'layout'] },
};

function makeWidget(type: string) {
  return {
    widget: {
      config: {
        name: 'test',
        displayName: 'Test',
        active: true,
        type,
        size: 'full',
        sortOrder: 0,
      },
      data: { name: 'test', active: true },
    },
    layout: 'full',
  };
}

describe('CmsWidget', () => {
  it('renders component for TextPageWidget type', () => {
    const wrapper = shallowMountComponent(CmsWidget, {
      props: makeWidget('TextPageWidget'),
      global: { stubs },
    });
    expect(wrapper.html()).not.toBe('');
  });

  it('renders component for HTMLPageWidget type', () => {
    const wrapper = shallowMountComponent(CmsWidget, {
      props: makeWidget('HTMLPageWidget'),
      global: { stubs },
    });
    expect(wrapper.html()).not.toBe('');
  });

  it('renders component for ImagePageWidget type', () => {
    const wrapper = shallowMountComponent(CmsWidget, {
      props: makeWidget('ImagePageWidget'),
      global: { stubs },
    });
    expect(wrapper.html()).not.toBe('');
  });

  it('renders component for BannerPageWidget type', () => {
    const wrapper = shallowMountComponent(CmsWidget, {
      props: makeWidget('BannerPageWidget'),
      global: { stubs },
    });
    expect(wrapper.html()).not.toBe('');
  });

  it('renders component for ButtonsPageWidget type', () => {
    const wrapper = shallowMountComponent(CmsWidget, {
      props: makeWidget('ButtonsPageWidget'),
      global: { stubs },
    });
    expect(wrapper.html()).not.toBe('');
  });

  it('renders component for VideoPageWidget type', () => {
    const wrapper = shallowMountComponent(CmsWidget, {
      props: makeWidget('VideoPageWidget'),
      global: { stubs },
    });
    expect(wrapper.html()).not.toBe('');
  });

  describe('widget images', () => {
    const images = [
      {
        fileName: 'hero.jpg',
        url: 'https://cdn.litium.media/acme/content/hero.jpg',
        largestSize: null,
      },
    ];
    const withImages = (type: string) => {
      const props = makeWidget(type);
      return { ...props, widget: { ...props.widget, images } };
    };

    // The widgets are async components: wait for the stub to render.
    async function mountProbe(type: string) {
      const wrapper = mountComponent(CmsWidget, {
        props: withImages(type),
        global: { stubs: imageStubs },
      });
      await vi.waitFor(() =>
        expect(wrapper.find('.images-probe').exists()).toBe(true),
      );
      return wrapper.findComponent(imagesProbe);
    }

    it.each(['ImagePageWidget', 'BannerPageWidget'])(
      'forwards them to a %s',
      async (type) => {
        expect((await mountProbe(type)).props('images')).toEqual(images);
      },
    );

    it('does not forward them to another widget', async () => {
      const probe = await mountProbe('TextPageWidget');
      expect(probe.props('images')).toBeUndefined();
      expect(probe.attributes('images')).toBeUndefined();
    });
  });

  it('shows dev warning for unknown widget type', () => {
    // In test/dev mode, import.meta.dev is true
    const wrapper = shallowMountComponent(CmsWidget, {
      props: makeWidget('UnknownWidgetType'),
      global: { stubs },
    });
    const warning = wrapper.find('[data-testid="cms-widget-unknown"]');
    expect(warning.exists()).toBe(true);
    expect(warning.text()).toContain('UnknownWidgetType');
  });

  it('renders nothing when config type is missing', () => {
    const wrapper = shallowMountComponent(CmsWidget, {
      props: {
        widget: {
          config: {
            name: 'test',
            displayName: 'Test',
            active: true,
            type: '',
            size: 'full',
            sortOrder: 0,
          },
          data: {},
        },
        layout: 'full',
      },
      global: { stubs },
    });
    expect(wrapper.html()).toBe('<!--v-if-->');
  });
});

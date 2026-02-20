import { describe, it, expect } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
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

  it('renders nothing for unknown widget type', () => {
    const wrapper = shallowMountComponent(CmsWidget, {
      props: makeWidget('UnknownWidgetType'),
      global: { stubs },
    });
    expect(wrapper.html()).toBe('<!--v-if-->');
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

import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import BannerWidget from '../../../app/components/cms/widgets/BannerWidget.vue';

const geinsImageStub = {
  template: '<div class="geins-image" />',
  props: ['fileName', 'type', 'alt', 'loading'],
};

const stubs = {
  GeinsImage: geinsImageStub,
  SharedGeinsImage: geinsImageStub,
};

function makeProps(
  overrides: {
    text1?: string;
    text2?: string;
    buttonText?: string;
    href?: string;
    textAndButtonPlacement?: number;
    textAndButtonPlacementFullWidth?: number;
    textColor?: number;
    classNames?: string;
    size?: string;
    layout?: string;
  } = {},
) {
  return {
    data: {
      name: 'test',
      active: true,
      image: {
        filename: 'hero.jpg',
        ...(overrides.href ? { href: overrides.href } : {}),
      },
      text1: overrides.text1,
      text2: overrides.text2,
      buttonText: overrides.buttonText,
      textAndButtonPlacement: overrides.textAndButtonPlacement,
      textAndButtonPlacementFullWidth:
        overrides.textAndButtonPlacementFullWidth,
      textColor: overrides.textColor,
      classNames: overrides.classNames,
    },
    config: {
      name: 'test',
      displayName: 'Banner',
      active: true,
      type: 'BannerPageWidget',
      size: overrides.size ?? 'full',
      sortOrder: 0,
    },
    layout: overrides.layout ?? 'full',
  };
}

describe('BannerWidget', () => {
  it('renders overlay text1', () => {
    const wrapper = mountComponent(BannerWidget, {
      props: makeProps({ text1: 'Big Sale' }),
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Big Sale');
  });

  it('renders overlay text2', () => {
    const wrapper = mountComponent(BannerWidget, {
      props: makeProps({ text2: 'Up to 50% off' }),
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Up to 50% off');
  });

  it('renders buttonText', () => {
    const wrapper = mountComponent(BannerWidget, {
      props: makeProps({ buttonText: 'Shop Now' }),
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Shop Now');
  });

  it('does not render text when all fields are empty', () => {
    const wrapper = mountComponent(BannerWidget, {
      props: makeProps({}),
      global: { stubs },
    });
    expect(wrapper.findAll('p')).toHaveLength(0);
  });

  it('wraps in NuxtLink when href exists', () => {
    const wrapper = mountComponent(BannerWidget, {
      props: makeProps({ href: '/sale', text1: 'Sale' }),
      global: { stubs },
    });
    expect(wrapper.find('a').exists()).toBe(true);
  });

  it('renders GeinsImage with eager loading', () => {
    const wrapper = mountComponent(BannerWidget, {
      props: makeProps({}),
      global: { stubs },
    });
    expect(wrapper.find('.geins-image').exists()).toBe(true);
  });

  /**
   * ralph-ui reference: CaWidgetBanner.vue
   * Full-width: always overlay. textAndButtonPlacementFullWidth: 0=left, 1=middle, 2=right
   * Not full-width: textAndButtonPlacement: 0=below-image, 1=on-image
   */
  describe('text placement (ralph-ui: CaWidgetBanner)', () => {
    it('full-width: always renders as overlay', () => {
      const wrapper = mountComponent(BannerWidget, {
        props: makeProps({
          text1: 'Title',
          textAndButtonPlacementFullWidth: 0,
          size: 'full',
        }),
        global: { stubs },
      });
      expect(wrapper.find('.absolute').exists()).toBe(true);
    });

    it('full-width: 0 = left-aligned overlay', () => {
      const wrapper = mountComponent(BannerWidget, {
        props: makeProps({
          text1: 'Title',
          textAndButtonPlacementFullWidth: 0,
          size: 'full',
        }),
        global: { stubs },
      });
      expect(wrapper.find('.items-start').exists()).toBe(true);
    });

    it('full-width: 1 = center-aligned overlay', () => {
      const wrapper = mountComponent(BannerWidget, {
        props: makeProps({
          text1: 'Title',
          textAndButtonPlacementFullWidth: 1,
          size: 'full',
        }),
        global: { stubs },
      });
      expect(wrapper.find('.items-center').exists()).toBe(true);
    });

    it('full-width: 2 = right-aligned overlay', () => {
      const wrapper = mountComponent(BannerWidget, {
        props: makeProps({
          text1: 'Title',
          textAndButtonPlacementFullWidth: 2,
          size: 'full',
        }),
        global: { stubs },
      });
      expect(wrapper.find('.items-end').exists()).toBe(true);
    });

    it('not full-width: 0 = below-image (no overlay)', () => {
      const wrapper = mountComponent(BannerWidget, {
        props: makeProps({
          text1: 'Title',
          textAndButtonPlacement: 0,
          size: 'half',
          layout: 'half',
          classNames: 'half',
        }),
        global: { stubs },
      });
      expect(wrapper.find('.absolute').exists()).toBe(false);
      expect(wrapper.text()).toContain('Title');
    });

    it('not full-width: 1 = on-image (overlay)', () => {
      const wrapper = mountComponent(BannerWidget, {
        props: makeProps({
          text1: 'Title',
          textAndButtonPlacement: 1,
          size: 'half',
          layout: 'half',
          classNames: 'half',
        }),
        global: { stubs },
      });
      expect(wrapper.find('.absolute').exists()).toBe(true);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import ButtonsWidget from '../../../app/components/cms/widgets/ButtonsWidget.vue';

function makeProps(buttons: Array<{ text: string; href: string }> = []) {
  return {
    data: {
      name: 'test',
      active: true,
      buttons,
    },
    config: {
      name: 'test',
      displayName: 'Buttons',
      active: true,
      type: 'ButtonsPageWidget',
      size: 'full',
      sortOrder: 0,
    },
    layout: 'full',
  };
}

describe('ButtonsWidget', () => {
  it('renders a NuxtLink for each button', () => {
    const wrapper = mountComponent(ButtonsWidget, {
      props: makeProps([
        { text: 'Shop', href: '/shop' },
        { text: 'About', href: '/about' },
        { text: 'Contact', href: '/contact' },
      ]),
    });
    const links = wrapper.findAll('a');
    expect(links).toHaveLength(3);
    expect(links[0].text()).toBe('Shop');
    expect(links[1].text()).toBe('About');
    expect(links[2].text()).toBe('Contact');
  });

  it('renders nothing when buttons array is empty', () => {
    const wrapper = mountComponent(ButtonsWidget, {
      props: makeProps([]),
    });
    expect(wrapper.find('a').exists()).toBe(false);
    expect(wrapper.find('.flex').exists()).toBe(false);
  });

  it('renders nothing when buttons is undefined', () => {
    const wrapper = mountComponent(ButtonsWidget, {
      props: {
        data: {
          name: 'test',
          active: true,
          buttons: undefined as unknown as Array<{
            text: string;
            href: string;
          }>,
        },
        config: {
          name: 'test',
          displayName: 'Buttons',
          active: true,
          type: 'ButtonsPageWidget',
          size: 'full',
          sortOrder: 0,
        },
        layout: 'full',
      },
    });
    expect(wrapper.find('a').exists()).toBe(false);
  });

  it('renders single button correctly', () => {
    const wrapper = mountComponent(ButtonsWidget, {
      props: makeProps([{ text: 'Buy Now', href: '/buy' }]),
    });
    const links = wrapper.findAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].text()).toBe('Buy Now');
  });
});

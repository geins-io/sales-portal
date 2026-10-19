import { describe, it, expect, vi, afterEach } from 'vitest';
import { mountComponent } from '../../utils/component';
import ButtonsWidget from '../../../app/components/cms/widgets/ButtonsWidget.vue';
import type { ButtonItem } from '../../../shared/types/cms';

// Shaped as the CMS sends a buttons widget: `buttonText` and `url`, with an
// empty `url` for a button saved without a link.
function makeProps(buttons: ButtonItem[] | undefined) {
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a link with the button text for each button', () => {
    const wrapper = mountComponent(ButtonsWidget, {
      props: makeProps([
        { buttonText: 'Shop', url: '/shop' },
        { buttonText: 'About', url: '/about' },
        { buttonText: 'Contact', url: '/contact' },
      ]),
    });
    const links = wrapper.findAll('a');
    expect(links.map((link) => link.text())).toEqual([
      'Shop',
      'About',
      'Contact',
    ]);
    expect(links.map((link) => link.attributes('href'))).toEqual([
      '/se/en/shop',
      '/se/en/about',
      '/se/en/contact',
    ]);
  });

  it('strips the Geins market and locale prefix from the url', () => {
    const wrapper = mountComponent(ButtonsWidget, {
      props: makeProps([{ buttonText: 'Tools', url: '/se/sv/c/verktyg' }]),
    });
    expect(wrapper.find('a').attributes('href')).toBe('/se/en/c/verktyg');
  });

  it('links an external url as it is, with no locale prefix', () => {
    const wrapper = mountComponent(ButtonsWidget, {
      props: makeProps([
        { buttonText: 'Extern', url: 'https://example.com/x' },
      ]),
    });
    expect(wrapper.find('a').attributes('href')).toBe('https://example.com/x');
  });

  it('leaves out a button without a link and renders the others without an error', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = mountComponent(ButtonsWidget, {
      props: makeProps([
        { buttonText: 'Shop', url: '/shop' },
        { buttonText: 'Empty link', url: '' },
        { buttonText: 'No link' },
        { buttonText: 'About', url: '/about' },
      ]),
    });
    expect(wrapper.findAll('a').map((link) => link.text())).toEqual([
      'Shop',
      'About',
    ]);
    expect(wrapper.text()).not.toContain('Empty link');
    expect(wrapper.text()).not.toContain('No link');
    expect(error).not.toHaveBeenCalled();
  });

  it('renders nothing when no button has a link', () => {
    const wrapper = mountComponent(ButtonsWidget, {
      props: makeProps([
        { buttonText: 'Empty link', url: '' },
        { buttonText: 'No link' },
      ]),
    });
    expect(wrapper.find('a').exists()).toBe(false);
    expect(wrapper.find('.flex').exists()).toBe(false);
  });

  it('renders nothing when the buttons array is empty', () => {
    const wrapper = mountComponent(ButtonsWidget, { props: makeProps([]) });
    expect(wrapper.find('.flex').exists()).toBe(false);
  });

  it('renders nothing when buttons is undefined', () => {
    const wrapper = mountComponent(ButtonsWidget, {
      props: makeProps(undefined),
    });
    expect(wrapper.find('.flex').exists()).toBe(false);
  });
});

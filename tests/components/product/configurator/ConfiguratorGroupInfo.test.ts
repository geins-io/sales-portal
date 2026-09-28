import { describe, it, expect, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import type { ConfigurationMessage } from '#shared/types/configurator';
import { mountComponent } from '../../../utils/component';
import ConfiguratorGroupInfo from '../../../../app/components/product/configurator/ConfiguratorGroupInfo.vue';

// The real tooltip primitive, not a stub: how it opens is the point here. Its
// content is teleported, so it is looked for in the document body.
const CONTENT = '[data-testid="configurator-group-info-content"]';

const MESSAGES: ConfigurationMessage[] = [
  { severity: 'info', text: 'Only the ABS edge band fits a steel top.' },
];

let wrapper: ReturnType<typeof mountInfo> | undefined;

function mountInfo(messages: ConfigurationMessage[] = MESSAGES) {
  return mountComponent(ConfiguratorGroupInfo, {
    props: { messages, groupName: 'Edge profile' },
    attachTo: document.body,
  });
}

function content(): Element | null {
  return document.body.querySelector(CONTENT);
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe('ConfiguratorGroupInfo', () => {
  it('renders nothing without a message', () => {
    wrapper = mountInfo([]);

    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('is a button named after its group, closed to begin with', () => {
    wrapper = mountInfo();

    const button = wrapper.find('button');
    expect(button.attributes('type')).toBe('button');
    expect(button.attributes('aria-label')).toBe('configurator.group_info');
    expect(content()).toBeNull();
  });

  it('opens on keyboard focus and describes the button while open', async () => {
    wrapper = mountInfo();
    const button = wrapper.find('button');

    await button.trigger('focus');
    await flushPromises();

    expect(content()?.textContent).toContain(
      'Only the ABS edge band fits a steel top.',
    );
    // What a screen reader hears after the button's name.
    expect(button.attributes('aria-describedby')).toBeTruthy();

    await button.trigger('blur');
    await flushPromises();
    expect(content()).toBeNull();
  });

  // A tap is a pointer press and a click. The primitive opens on neither, so
  // a tooltip alone would never show on a phone.
  it('opens on a tap, and stays open for a second one', async () => {
    wrapper = mountInfo();
    const button = wrapper.find('button');

    await button.trigger('pointerdown', { pointerType: 'touch' });
    await button.trigger('click');
    await flushPromises();
    expect(content()?.textContent).toContain(
      'Only the ABS edge band fits a steel top.',
    );

    await button.trigger('pointerdown', { pointerType: 'touch' });
    await button.trigger('click');
    await flushPromises();
    expect(content()).not.toBeNull();
  });

  it('closes on Escape', async () => {
    wrapper = mountInfo();
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(content()).not.toBeNull();

    // The primitive listens on the window, where a real keypress bubbles to.
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await flushPromises();

    expect(content()).toBeNull();
  });
});

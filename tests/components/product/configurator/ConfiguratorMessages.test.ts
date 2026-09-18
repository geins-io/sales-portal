import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../../utils/component';
import ConfiguratorMessages from '../../../../app/components/product/configurator/ConfiguratorMessages.vue';
import {
  findOption,
  findOptionGroup,
  makeCascadedConfiguration,
  makeInvalidConfiguration,
} from '../../../fixtures/configurator';

describe('ConfiguratorMessages', () => {
  it('renders nothing when the node has nothing to say', () => {
    const wrapper = mountComponent(ConfiguratorMessages, {
      props: { messages: [] },
    });

    expect(wrapper.find('[data-testid="configurator-message"]').exists()).toBe(
      false,
    );
  });

  it('renders the error a rule put on a group', () => {
    const invalid = makeInvalidConfiguration();
    const top = findOptionGroup(invalid, 'top');
    top.messages = [
      { severity: 'error', text: 'That table top is out of production.' },
    ];

    const wrapper = mountComponent(ConfiguratorMessages, {
      props: { messages: top.messages },
    });

    const rows = wrapper.findAll('[data-testid="configurator-message"]');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.attributes('data-severity')).toBe('error');
    expect(rows[0]?.text()).toContain('That table top is out of production.');
  });

  it('renders a warning as a warning', () => {
    const cascaded = makeCascadedConfiguration();
    const wrapper = mountComponent(ConfiguratorMessages, {
      props: { messages: findOption(cascaded, 'acc-power').messages },
    });

    const row = wrapper.find('[data-testid="configurator-message"]');
    expect(row.attributes('data-severity')).toBe('warning');
    expect(row.text()).toContain('Electric legs require a power strip.');
  });

  it('renders one row per message', () => {
    const wrapper = mountComponent(ConfiguratorMessages, {
      props: {
        messages: [
          { severity: 'error', text: 'one' },
          { severity: 'warning', text: 'two' },
        ],
      },
    });

    expect(
      wrapper.findAll('[data-testid="configurator-message"]'),
    ).toHaveLength(2);
  });
});

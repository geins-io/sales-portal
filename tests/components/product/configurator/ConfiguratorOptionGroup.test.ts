import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../../utils/component';
import ConfiguratorOptionGroup from '../../../../app/components/product/configurator/ConfiguratorOptionGroup.vue';
import type { ConfigurationOptionGroup } from '#shared/types/configurator';
import {
  findOptionGroup,
  makeCabinetConfiguration,
  makeInitialConfiguration,
  makeInvalidConfiguration,
  makeNestedGroupConfiguration,
} from '../../../fixtures/configurator';

function mountGroup(group: ConfigurationOptionGroup) {
  return mountComponent(ConfiguratorOptionGroup, { props: { group } });
}

describe('ConfiguratorOptionGroup', () => {
  it('renders a single-choice group as a radio group', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));

    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(true);
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(3);
    expect(wrapper.text()).toContain('configurator.choose_one');
  });

  it('renders a multi-choice group as checkboxes', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'industrial'));

    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false);
    expect(wrapper.findAll('[role="checkbox"]')).toHaveLength(2);
    expect(wrapper.text()).toContain('configurator.choose_many');
  });

  it('marks a group that must be answered', () => {
    const workbench = makeInitialConfiguration();

    const required = mountGroup(findOptionGroup(workbench, 'top'));
    const optional = mountGroup(findOptionGroup(workbench, 'accessories'));

    expect(required.text()).toContain('configurator.required');
    expect(optional.text()).not.toContain('configurator.required');
  });

  it('shows the error an unanswered required group carries', () => {
    const invalid = makeInvalidConfiguration();

    const wrapper = mountGroup(findOptionGroup(invalid, 'top'));

    const message = wrapper.find('[data-testid="configurator-message"]');
    expect(message.attributes('data-severity')).toBe('error');
    expect(message.text()).toContain('Select a table top.');
  });

  it('emits one change for the row picked, not a deselect for the one it replaces', async () => {
    const workbench = makeInitialConfiguration();
    const top = findOptionGroup(workbench, 'top');

    const wrapper = mountGroup(top);
    await wrapper
      .find('[data-option-id="top-steel"] [role="radio"]')
      .trigger('click');

    expect(wrapper.emitted('change')).toHaveLength(1);
    expect(wrapper.emitted('change')?.[0]?.[0]).toEqual({
      type: 'option',
      optionId: 'top-steel',
      instanceId: '0',
      selected: true,
      quantity: 1,
      lock: 'none',
    });
  });

  it('checks the row the document says is selected', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));

    const checked = wrapper.findAll('[role="radio"][aria-checked="true"]');
    expect(checked).toHaveLength(1);
    expect(
      checked[0]?.element
        .closest('[data-option-id]')
        ?.getAttribute('data-option-id'),
    ).toBe('top-laminate');
  });

  it('disables the radio of a row the provider locked', () => {
    const cabinet = makeCabinetConfiguration();

    const wrapper = mountGroup(findOptionGroup(cabinet, 'mount'));

    const radio = wrapper.find('[data-option-id="mount-wall"] [role="radio"]');
    expect(radio.attributes('disabled')).toBeDefined();
    expect(radio.attributes('title')).toBe(
      'This cabinet is always wall mounted.',
    );
  });

  it('renders a group nested inside a group', () => {
    const nested = makeNestedGroupConfiguration();

    const wrapper = mountGroup(findOptionGroup(nested, 'legs'));

    const groups = wrapper.findAll('[data-testid="configurator-group"]');
    expect(groups.map((g) => g.attributes('data-group-id'))).toEqual([
      'legs',
      'industrial',
    ]);
  });

  it('passes a change from a nested group up untouched', async () => {
    const nested = makeNestedGroupConfiguration();

    const wrapper = mountGroup(findOptionGroup(nested, 'legs'));
    await wrapper
      .find('[data-option-id="ind-heavy"] [role="checkbox"]')
      .trigger('click');

    expect(wrapper.emitted('change')?.[0]?.[0]).toMatchObject({
      optionId: 'ind-heavy',
      selected: true,
    });
  });
});

import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../../utils/component';
import ConfiguratorOptionRow from '../../../../app/components/product/configurator/ConfiguratorOptionRow.vue';
import type { ConfigurationOption } from '#shared/types/configurator';
import {
  findOption,
  makeCabinetConfiguration,
  makeCascadedConfiguration,
  makeInitialConfiguration,
} from '../../../fixtures/configurator';

function mountRow(
  option: ConfigurationOption,
  props: { single?: boolean; quantityEditable?: boolean } = {},
) {
  return mountComponent(ConfiguratorOptionRow, {
    props: { option, single: false, ...props },
  });
}

describe('ConfiguratorOptionRow', () => {
  it('renders the embedded product rather than looking one up', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountRow(findOption(workbench, 'top-wood'));

    expect(wrapper.text()).toContain('Solid beech top');
    expect(wrapper.text()).toContain('KONF-1001-TOP-WOOD');
  });

  it('renders the row price from the option, not from the product', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountRow(findOption(workbench, 'top-wood'));

    const price = wrapper.find('[data-testid="configurator-option-price"]');
    // The option's own net price, formatted by Intl for the locale the
    // component tier mocks — not the product's incl-VAT selling price.
    expect(price.text()).toContain('1,400');
    expect(price.text()).toContain('SEK');
  });

  it('disables a row the rules made unavailable and shows the reason', () => {
    const cascaded = makeCascadedConfiguration();

    const wrapper = mountRow(findOption(cascaded, 'acc-castors'));

    const checkbox = wrapper.find('[role="checkbox"]');
    expect(checkbox.attributes('disabled')).toBeDefined();
    expect(checkbox.attributes('title')).toBe(
      'Braked castors cannot be combined with electric legs.',
    );
    expect(
      wrapper.find('[data-testid="configurator-message"]').text(),
    ).toContain('Braked castors cannot be combined with electric legs.');
  });

  it('disables a row the provider locked and shows its reason', () => {
    const cabinet = makeCabinetConfiguration();

    // Rendered as a checkbox: a RadioGroupItem needs its RadioGroup, and the
    // locked state is the row's own decision either way. The radio form of it
    // is covered where the group is.
    const wrapper = mountRow(findOption(cabinet, 'mount-wall'));

    const checkbox = wrapper.find('[role="checkbox"]');
    expect(checkbox.attributes('disabled')).toBeDefined();
    expect(checkbox.attributes('title')).toBe(
      'This cabinet is always wall mounted.',
    );
  });

  it('falls back to a translated reason when the provider gave none', () => {
    const workbench = makeInitialConfiguration();
    const option = findOption(workbench, 'top-wood');
    option.available = false;

    const wrapper = mountRow(option);

    expect(wrapper.find('[role="checkbox"]').attributes('title')).toBe(
      'configurator.unavailable',
    );
  });

  it('emits a selection when the checkbox is clicked', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountRow(findOption(workbench, 'ind-esd'));
    await wrapper.find('[role="checkbox"]').trigger('click');

    expect(wrapper.emitted('change')?.[0]?.[0]).toEqual({
      type: 'option',
      optionId: 'ind-esd',
      instanceId: '0',
      selected: true,
      quantity: 1,
      lock: 'none',
    });
  });

  it('emits a deselection for a row that was selected', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountRow(findOption(workbench, 'top-laminate'));
    await wrapper.find('[role="checkbox"]').trigger('click');

    expect(wrapper.emitted('change')?.[0]?.[0]).toMatchObject({
      optionId: 'top-laminate',
      selected: false,
    });
  });

  it('emits nothing when a disabled row is clicked', async () => {
    const cascaded = makeCascadedConfiguration();

    const wrapper = mountRow(findOption(cascaded, 'acc-castors'));
    await wrapper.find('[role="checkbox"]').trigger('click');

    expect(wrapper.emitted('change')).toBeUndefined();
  });

  it('offers a quantity only on a selected row of a quantity-editable group', () => {
    const workbench = makeInitialConfiguration();
    const selected = findOption(workbench, 'acc-power');
    selected.selected = true;

    const off = mountRow(findOption(workbench, 'acc-light'), {
      quantityEditable: true,
    });
    const on = mountRow(selected, { quantityEditable: true });
    const notEditable = mountRow(selected);

    expect(
      off.find('[data-testid="configurator-option-quantity"]').exists(),
    ).toBe(false);
    expect(
      on.find('[data-testid="configurator-option-quantity"]').exists(),
    ).toBe(true);
    expect(
      notEditable.find('[data-testid="configurator-option-quantity"]').exists(),
    ).toBe(false);
  });

  it('emits the new quantity, keeping the row selected', async () => {
    const workbench = makeInitialConfiguration();
    const option = findOption(workbench, 'acc-power');
    option.selected = true;

    const wrapper = mountRow(option, { quantityEditable: true });
    await wrapper.find('[data-testid="qty-increment"]').trigger('click');

    expect(wrapper.emitted('change')?.[0]?.[0]).toEqual({
      type: 'option',
      optionId: 'acc-power',
      instanceId: '0',
      selected: true,
      quantity: 2,
      lock: 'none',
    });
  });
});

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
    // component tier mocks — not the product's incl-VAT selling price. Signed,
    // because what the row shows is what choosing it adds.
    expect(price.text()).toContain('1,400');
    expect(price.text()).toContain('SEK');
    expect(price.text().startsWith('+')).toBe(true);
  });

  it('shows a discounted row at the price it arrives with and its percentage', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountRow(findOption(workbench, 'acc-pegboard'));

    // The seed's 900 is already 25 % off; the row does no arithmetic on it.
    const price = wrapper.find('[data-testid="configurator-option-price"]');
    expect(price.text()).toContain('900');
    expect(price.text()).not.toContain('675');
    expect(
      wrapper.find('[data-testid="configurator-option-discount"]').text(),
    ).toBe('−25%');
  });

  it('keeps the percentage with the price when the price moves under the name', () => {
    const workbench = makeInitialConfiguration();
    const option = findOption(workbench, 'acc-pegboard');
    option.selected = true;

    const wrapper = mountRow(option, { quantityEditable: true });

    const badge = wrapper.find('[data-testid="configurator-option-discount"]');
    expect(badge.element.parentElement).toBe(
      wrapper.find('[data-testid="configurator-option-price"]').element,
    );
  });

  it('shows no percentage on a row without a discount', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountRow(findOption(workbench, 'top-wood'));

    expect(
      wrapper.find('[data-testid="configurator-option-discount"]').exists(),
    ).toBe(false);
  });

  it('shows no price on a row that adds nothing', () => {
    const workbench = makeInitialConfiguration();

    // Every group would otherwise carry a column of zeroes: the laminate top
    // and most of the RAL colours are included in the base price.
    const wrapper = mountRow(findOption(workbench, 'top-laminate'));

    expect(
      wrapper.find('[data-testid="configurator-option-price"]').exists(),
    ).toBe(false);
  });

  it('renders no image for a part that has none', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountRow(findOption(workbench, 'top-wood'));

    // The parts of a configuration have no catalogue image; a placeholder on
    // every row is noise, and a file name that resolves to nothing is worse.
    expect(wrapper.find('img').exists()).toBe(false);
  });

  it('disables a row the rules made unavailable and shows the reason', () => {
    const cascaded = makeCascadedConfiguration();

    const wrapper = mountRow(findOption(cascaded, 'acc-castors'));

    const checkbox = wrapper.find('[role="checkbox"]');
    expect(checkbox.attributes('disabled')).toBeDefined();
    expect(checkbox.attributes('title')).toBe(
      'Braked castors cannot be combined with electric legs.',
    );
    // The provider's message is the row's reason, so it reads once, on the
    // row, and not a second time as a message under it.
    expect(
      wrapper.find('[data-testid="configurator-option-reason"]').text(),
    ).toBe('Braked castors cannot be combined with electric legs.');
    expect(wrapper.find('[data-testid="configurator-message"]').exists()).toBe(
      false,
    );
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

  // ---------------------------------------------------------------------
  // The whole row is the control
  // ---------------------------------------------------------------------
  it('toggles on a click anywhere on the row', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountRow(findOption(workbench, 'ind-esd'));
    await wrapper.find('[data-testid="configurator-option"]').trigger('click');

    expect(wrapper.emitted('change')?.[0]?.[0]).toMatchObject({
      optionId: 'ind-esd',
      selected: true,
    });
  });

  it('sends one change when the control itself is clicked', async () => {
    const workbench = makeInitialConfiguration();

    // The control sits inside the row, so without the row letting it through
    // alone a single press would be counted twice and cancel itself out.
    const wrapper = mountRow(findOption(workbench, 'ind-esd'));
    await wrapper.find('[role="checkbox"]').trigger('click');

    expect(wrapper.emitted('change')).toHaveLength(1);
  });

  it('emits nothing when a blocked row is clicked anywhere', async () => {
    const cascaded = makeCascadedConfiguration();

    const wrapper = mountRow(findOption(cascaded, 'acc-castors'));
    await wrapper.find('[data-testid="configurator-option"]').trigger('click');

    expect(wrapper.emitted('change')).toBeUndefined();
  });

  it('emits nothing on a row the page has locked for a batch', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountComponent(ConfiguratorOptionRow, {
      props: {
        option: findOption(workbench, 'ind-esd'),
        single: false,
        disabled: true,
      },
    });
    await wrapper.find('[data-testid="configurator-option"]').trigger('click');

    expect(wrapper.emitted('change')).toBeUndefined();
  });

  it('changes the quantity without toggling the row it sits on', async () => {
    const workbench = makeInitialConfiguration();
    const option = findOption(workbench, 'acc-power');
    option.selected = true;

    const wrapper = mountRow(option, { quantityEditable: true });
    await wrapper.find('[data-testid="qty-increment"]').trigger('click');

    expect(wrapper.emitted('change')).toHaveLength(1);
  });

  // ---------------------------------------------------------------------
  // Row states
  // ---------------------------------------------------------------------
  it('states why an unavailable row cannot be chosen, in the colour of a refusal', () => {
    const cascaded = makeCascadedConfiguration();

    const wrapper = mountRow(findOption(cascaded, 'acc-castors'));

    const reason = wrapper.find('[data-testid="configurator-option-reason"]');
    expect(reason.text()).toBe(
      'Braked castors cannot be combined with electric legs.',
    );
    expect(reason.classes()).toContain('text-destructive');
    expect(
      wrapper.find('[data-testid="configurator-option-lock"]').exists(),
    ).toBe(false);
  });

  it('marks a row the provider owns with a lock and a note, not a refusal', () => {
    const cabinet = makeCabinetConfiguration();

    const wrapper = mountRow(findOption(cabinet, 'mount-wall'));

    expect(
      wrapper.find('[data-testid="configurator-option-lock"]').exists(),
    ).toBe(true);
    const reason = wrapper.find('[data-testid="configurator-option-reason"]');
    expect(reason.text()).toBe('This cabinet is always wall mounted.');
    expect(reason.classes()).toContain('text-muted-foreground');
  });

  it('calls a row that is both locked and unavailable a refusal', () => {
    const cabinet = makeCabinetConfiguration();
    const option = findOption(cabinet, 'mount-wall');
    option.available = false;

    // The rules refusing the row is the harder fact, so it wins the colour;
    // the lock still says who owns the row.
    const wrapper = mountRow(option);

    expect(
      wrapper.find('[data-testid="configurator-option-reason"]').classes(),
    ).toContain('text-destructive');
    expect(
      wrapper.find('[data-testid="configurator-option-lock"]').exists(),
    ).toBe(true);
  });

  it('gives the right edge to the stepper and moves the price under the name', () => {
    const workbench = makeInitialConfiguration();
    const option = findOption(workbench, 'acc-power');
    option.selected = true;

    const wrapper = mountRow(option, { quantityEditable: true });

    // The stepper is a sibling of the whole content column, not a line inside
    // it, and the price has left the name's row for the column below it.
    const row = wrapper.find('[data-testid="configurator-option"] > div');
    const stepper = wrapper.find(
      '[data-testid="configurator-option-quantity"]',
    );
    const price = wrapper.find('[data-testid="configurator-option-price"]');
    expect(stepper.element.parentElement).toBe(row.element);
    expect(price.element.parentElement).not.toBe(
      wrapper.find('p.font-medium').element.parentElement,
    );
  });

  it('keeps the price beside the name on a row with no quantity', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountRow(findOption(workbench, 'top-wood'));

    const price = wrapper.find('[data-testid="configurator-option-price"]');
    const name = wrapper.find('p.font-medium');
    expect(price.element.parentElement).toBe(name.element.parentElement);
  });

  it('states nothing on a row that can simply be chosen', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountRow(findOption(workbench, 'ind-esd'));

    expect(
      wrapper.find('[data-testid="configurator-option-reason"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="configurator-option-lock"]').exists(),
    ).toBe(false);
  });

  it('says nothing about a row the page locked for a batch in flight', () => {
    const workbench = makeInitialConfiguration();

    // A request in the air is not a fact about this row, and a reason that
    // appears for a second while one is sent would be noise.
    const wrapper = mountComponent(ConfiguratorOptionRow, {
      props: {
        option: findOption(workbench, 'ind-esd'),
        single: false,
        disabled: true,
      },
    });

    expect(
      wrapper.find('[data-testid="configurator-option-reason"]').exists(),
    ).toBe(false);
  });

  it('names the row from the option, not from the embedded product', () => {
    const workbench = makeInitialConfiguration();
    const option = findOption(workbench, 'top-wood');
    option.name = 'Beech top, provider name';
    option.articleNumber = 'ERP-4711';

    const wrapper = mountRow(option);

    expect(wrapper.text()).toContain('Beech top, provider name');
    expect(wrapper.text()).toContain('ERP-4711');
    expect(wrapper.text()).not.toContain('Solid beech top');
  });

  it('renders a row without a product from the option alone, with no image', () => {
    const workbench = makeInitialConfiguration();
    const withProduct = findOption(workbench, 'top-wood');
    withProduct.product!.productImages = [
      { fileName: 'beech.jpg', isPrimary: true, url: '' },
    ];
    const withoutProduct = { ...withProduct, product: null };

    expect(mountRow(withProduct).find('img').exists()).toBe(true);

    const wrapper = mountRow(withoutProduct);
    expect(wrapper.text()).toContain('Solid beech top');
    expect(wrapper.text()).toContain('KONF-1001-TOP-WOOD');
    expect(wrapper.find('img').exists()).toBe(false);
  });

  it('writes the description under the name, above the article number', () => {
    const workbench = makeInitialConfiguration();
    const option = findOption(workbench, 'top-wood');
    option.description = 'Oiled, 40 mm.';

    const wrapper = mountRow(option);

    const description = wrapper.find(
      '[data-testid="configurator-option-description"]',
    );
    expect(description.text()).toBe('Oiled, 40 mm.');
    const text = wrapper.text();
    expect(text.indexOf('Solid beech top')).toBeLessThan(
      text.indexOf('Oiled, 40 mm.'),
    );
    expect(text.indexOf('Oiled, 40 mm.')).toBeLessThan(
      text.indexOf('KONF-1001-TOP-WOOD'),
    );
  });

  it('renders nothing for an empty description', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountRow(findOption(workbench, 'top-wood'));

    expect(
      wrapper.find('[data-testid="configurator-option-description"]').exists(),
    ).toBe(false);
  });

  it('treats a read-only row as a locked one', async () => {
    const workbench = makeInitialConfiguration();
    const option = findOption(workbench, 'top-wood');
    option.readOnly = true;

    const wrapper = mountRow(option);

    expect(
      wrapper.find('[data-testid="configurator-option-lock"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[role="checkbox"]').attributes('disabled'),
    ).toBeDefined();
    expect(
      wrapper.find('[data-testid="configurator-option-reason"]').text(),
    ).toBe('configurator.read_only');
    await wrapper.find('[data-testid="configurator-option"]').trigger('click');
    expect(wrapper.emitted('change')).toBeUndefined();
  });
});

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
  props: {
    single?: boolean;
    quantityEditable?: boolean;
    imageColumn?: boolean;
  } = {},
) {
  return mountComponent(ConfiguratorOptionRow, {
    props: { option, single: false, imageColumn: false, ...props },
  });
}

const IMAGE = '[data-testid="configurator-option-image"]';
/** The one line a row lays its parts out on. */
const LINE = '[data-testid="configurator-option"] > div';
const PLACEHOLDER = '[data-testid="configurator-option-image-placeholder"]';

function withImage(option: ConfigurationOption, fileName: string) {
  option.product!.productImages = [{ fileName, isPrimary: false, url: '' }];
  return option;
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

  // As the prototype's option layouts: the price the row adds, as sent. A
  // discount is already in it, and the row strikes nothing through and shows
  // no percentage beside it.
  it('shows a discounted row at the price it arrives with, and nothing else', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountRow(findOption(workbench, 'acc-pegboard'));

    // The seed's 900 is already 25 % off 1,200; the row does no arithmetic on it.
    const price = wrapper.find('[data-testid="configurator-option-price"]');
    expect(price.text()).toContain('900');
    expect(price.text().startsWith('+')).toBe(true);
    expect(price.text()).not.toContain('675');
    expect(price.text()).not.toContain('1,200');
    expect(price.text()).not.toContain('%');
    expect(price.find('.line-through').exists()).toBe(false);
  });

  it('shows the same price whether the row stands alone or has a stepper', () => {
    const workbench = makeInitialConfiguration();
    const option = findOption(workbench, 'acc-pegboard');
    option.selected = true;

    const plain = mountRow(option)
      .find('[data-testid="configurator-option-price"]')
      .text();
    const stepped = mountRow(option, { quantityEditable: true })
      .find('[data-testid="configurator-option-price"]')
      .text();

    expect(stepped).toBe(plain);
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

  // The group decides whether its rows have an image column, so every row of
  // a group is the same shape: one with an image shows it, one without shows
  // a placeholder the same size, and a group where no row has one has none.
  it('renders no image box when the group has no image column', () => {
    const workbench = makeInitialConfiguration();
    const option = withImage(findOption(workbench, 'top-wood'), 'beech.jpg');

    const wrapper = mountRow(option, { imageColumn: false });

    expect(wrapper.find(IMAGE).exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'GeinsImage' }).exists()).toBe(false);
  });

  it('renders a placeholder for a part without an image in a group with an image column', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountRow(findOption(workbench, 'top-wood'), {
      imageColumn: true,
    });

    expect(wrapper.find(IMAGE).exists()).toBe(true);
    expect(wrapper.find(PLACEHOLDER).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'GeinsImage' }).exists()).toBe(false);
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
        imageColumn: false,
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

  // As the prototype's option layouts: [indicator][image][name][stepper][price],
  // the price at the right edge whether or not the row has a stepper.
  it('puts the stepper left of the price and the price at the right edge', () => {
    const workbench = makeInitialConfiguration();
    const option = findOption(workbench, 'acc-power');
    option.selected = true;

    const wrapper = mountRow(option, { quantityEditable: true });

    const line = wrapper.find(LINE).element;
    const stepper = wrapper.find(
      '[data-testid="configurator-option-quantity"]',
    ).element;
    const price = wrapper.find('[data-testid="configurator-option-price"]');
    expect(price.element.parentElement).toBe(line);
    expect(line.lastElementChild).toBe(price.element);
    expect(stepper.parentElement).toBe(line);
    expect(stepper.nextElementSibling).toBe(price.element);
  });

  it('puts the price at the right edge of a row with no quantity', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountRow(findOption(workbench, 'top-wood'));

    const line = wrapper.find(LINE).element;
    const price = wrapper.find('[data-testid="configurator-option-price"]');
    expect(line.lastElementChild).toBe(price.element);
  });

  it('writes the price once, with or without a stepper', () => {
    const workbench = makeInitialConfiguration();
    const option = findOption(workbench, 'acc-power');
    option.selected = true;

    for (const quantityEditable of [false, true]) {
      expect(
        mountRow(option, { quantityEditable }).findAll(
          '[data-testid="configurator-option-price"]',
        ),
      ).toHaveLength(1);
    }
  });

  // Indicator, image, text, stepper and price sit on one centre line, with
  // or without a stepper.
  it('centres the indicator, the image and the text on the row', () => {
    const workbench = makeInitialConfiguration();
    const option = withImage(findOption(workbench, 'acc-pegboard'), 'peg.jpg');
    option.selected = true;

    for (const quantityEditable of [false, true]) {
      const wrapper = mountRow(option, { quantityEditable, imageColumn: true });
      const line = wrapper.find(LINE);
      expect(line.classes()).toContain('items-center');
      expect(wrapper.find(IMAGE).element.parentElement).toBe(line.element);
      expect(wrapper.find('.items-start').exists()).toBe(false);
      expect(wrapper.find('[role="checkbox"]').classes()).not.toContain(
        'mt-0.5',
      );
    }
  });

  it('keeps the radio of a single choice off any top margin', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountComponent(ConfiguratorOptionRow, {
      props: {
        option: findOption(workbench, 'top-wood'),
        single: true,
        imageColumn: false,
      },
      global: {
        stubs: {
          RadioGroupItem: {
            template: '<button role="radio" v-bind="$attrs" />',
          },
        },
      },
    });

    expect(wrapper.find('[role="radio"]').classes()).not.toContain('mt-0.5');
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
        imageColumn: false,
        disabled: true,
      },
    });

    expect(
      wrapper.find('[data-testid="configurator-option-reason"]').exists(),
    ).toBe(false);
  });

  it('disables a row of an unavailable group and says why, in the colour of a refusal', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountComponent(ConfiguratorOptionRow, {
      props: {
        option: findOption(workbench, 'ind-esd'),
        single: false,
        imageColumn: false,
        unavailable: true,
      },
    });

    expect(
      wrapper.find('[role="checkbox"]').attributes('disabled'),
    ).toBeDefined();
    const reason = wrapper.find('[data-testid="configurator-option-reason"]');
    expect(reason.text()).toBe('configurator.unavailable');
    expect(reason.classes()).toContain('text-destructive');
  });

  it('emits nothing when a row of an unavailable group is clicked', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountComponent(ConfiguratorOptionRow, {
      props: {
        option: findOption(workbench, 'ind-esd'),
        single: false,
        imageColumn: false,
        unavailable: true,
      },
    });
    await wrapper.find('[data-testid="configurator-option"]').trigger('click');

    expect(wrapper.emitted('change')).toBeUndefined();
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

  it('renders a row without a product from the option alone, with a placeholder for the image', () => {
    const workbench = makeInitialConfiguration();
    const withProduct = withImage(
      findOption(workbench, 'top-wood'),
      'beech.jpg',
    );
    const withoutProduct = { ...withProduct, product: null };

    expect(
      mountRow(withProduct, { imageColumn: true })
        .findComponent({ name: 'GeinsImage' })
        .exists(),
    ).toBe(true);

    const wrapper = mountRow(withoutProduct, { imageColumn: true });
    expect(wrapper.text()).toContain('Solid beech top');
    expect(wrapper.text()).toContain('KONF-1001-TOP-WOOD');
    expect(wrapper.findComponent({ name: 'GeinsImage' }).exists()).toBe(false);
    expect(wrapper.find(PLACEHOLDER).exists()).toBe(true);
  });

  it('renders the first image of the product, as the product card does', () => {
    // The list fragment the option's product arrives through selects no
    // `isPrimary`, so a lookup on the flag would never match.
    const workbench = makeInitialConfiguration();
    const option = findOption(workbench, 'top-wood');
    option.product!.productImages = [
      { fileName: 'beech-front.jpg', isPrimary: false, url: '' },
      { fileName: 'beech-side.jpg', isPrimary: false, url: '' },
    ];

    const wrapper = mountRow(option, { imageColumn: true });

    const images = wrapper.findAllComponents({ name: 'GeinsImage' });
    expect(images).toHaveLength(1);
    expect(images[0]!.props('fileName')).toBe('beech-front.jpg');
    expect(wrapper.find(PLACEHOLDER).exists()).toBe(false);
  });

  it('renders the image on a white box and the placeholder on a grey one, with no border', () => {
    const workbench = makeInitialConfiguration();
    const option = withImage(findOption(workbench, 'top-wood'), 'beech.jpg');

    const pictured = mountRow(option, { imageColumn: true }).find(IMAGE);
    const empty = mountRow(findOption(workbench, 'top-steel'), {
      imageColumn: true,
    }).find(IMAGE);

    for (const box of [pictured, empty]) {
      expect(box.classes()).toContain('size-10');
      expect(box.classes()).not.toContain('border');
    }
    expect(pictured.classes()).toContain('bg-background');
    expect(empty.classes()).toContain('bg-muted');
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

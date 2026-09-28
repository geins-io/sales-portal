import { describe, it, expect, vi } from 'vitest';
import { mountComponent } from '../../../utils/component';
import ConfiguratorOptionGroup from '../../../../app/components/product/configurator/ConfiguratorOptionGroup.vue';
import type { ConfigurationOptionGroup } from '#shared/types/configurator';
import {
  findOption,
  findOptionGroup,
  makeCabinetConfiguration,
  makeInitialConfiguration,
  makeInvalidConfiguration,
  makeNestedGroupConfiguration,
} from '../../../fixtures/configurator';

// Stub the sheet primitives so the panel's content can be asserted inline
// instead of in a portal, mirroring PortalItemRowsSheet.test.ts. The stub keeps
// the `open` gate: a closed panel renders nothing, exactly as the real one
// does, so the rows below are the group's own.
vi.mock('../../../../app/components/ui/sheet', () => ({
  Sheet: {
    template: '<div><slot v-if="open" /></div>',
    props: ['open'],
  },
  SheetContent: {
    template: '<div data-testid="configurator-group-sheet"><slot /></div>',
    props: ['side'],
  },
  SheetHeader: { template: '<div><slot /></div>' },
  SheetTitle: { template: '<div data-testid="sheet-title"><slot /></div>' },
}));

function mountGroup(group: ConfigurationOptionGroup) {
  return mountComponent(ConfiguratorOptionGroup, { props: { group } });
}

const CHOOSER = '[data-testid="configurator-group-chooser"]';
const ADD = '[data-testid="configurator-group-add"]';
const SHEET = '[data-testid="configurator-group-sheet"]';

/** The table top group with a fourth row, one past the inline limit. */
function fourTops(): ConfigurationOptionGroup {
  const top = findOptionGroup(makeInitialConfiguration(), 'top');
  top.options.push({ ...top.options[2]!, id: 'top-glass', selected: false });
  return top;
}

describe('ConfiguratorOptionGroup', () => {
  it('renders a single-choice group as a radio group', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));

    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(true);
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(3);
  });

  it('renders a multi-choice group as checkboxes', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'industrial'));

    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false);
    expect(wrapper.findAll('[role="checkbox"]')).toHaveLength(2);
    expect(wrapper.text()).toContain('configurator.choose_many');
  });

  // The header says what the buyer has to do with the group, on one line and in
  // one place: the requirement outranks the shape of the choice, so a required
  // group says so rather than how many rows it takes.
  it('says a required group must be answered', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));

    expect(wrapper.find('[data-testid="configurator-group-hint"]').text()).toBe(
      'configurator.required',
    );
  });

  it('says how many rows an optional group takes', () => {
    const workbench = makeInitialConfiguration();
    // Every single-choice group in this seed is also required, so the one case
    // the seed cannot show is built from the group it would otherwise be.
    const optionalSingle = {
      ...findOptionGroup(workbench, 'top'),
      minSelections: undefined,
    };

    const multi = mountGroup(findOptionGroup(workbench, 'accessories'));
    const single = mountGroup(optionalSingle);

    expect(multi.find('[data-testid="configurator-group-hint"]').text()).toBe(
      'configurator.choose_many',
    );
    expect(single.find('[data-testid="configurator-group-hint"]').text()).toBe(
      'configurator.optional',
    );
    expect(multi.text()).not.toContain('configurator.required');
  });

  it('heads the group with a name and nothing to decorate it', () => {
    const workbench = makeInitialConfiguration();

    const header = mountGroup(findOptionGroup(workbench, 'top')).find(
      '[data-testid="configurator-group-header"]',
    );

    expect(header.text()).toContain('Table top');
    // The asterisk this replaced said "required" in a colour and a glyph only.
    expect(header.text()).not.toContain('*');
  });

  it('shows the error a rule put on a group', () => {
    // Written here rather than taken from a document: an unmet requirement is
    // a property of the group and carries no message, so a group's error is
    // always something a rule had to say.
    const invalid = makeInvalidConfiguration();
    const top = findOptionGroup(invalid, 'top');
    top.messages = [
      { severity: 'error', text: 'That table top is out of production.' },
    ];

    const wrapper = mountGroup(top);

    const message = wrapper.find('[data-testid="configurator-message"]');
    expect(message.attributes('data-severity')).toBe('error');
    expect(message.text()).toContain('That table top is out of production.');
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

  // ---------------------------------------------------------------------
  // Folding
  // ---------------------------------------------------------------------
  it('opens the group and folds it on the header', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));
    const header = wrapper.find('[data-testid="configurator-group-header"]');
    expect(header.attributes('aria-expanded')).toBe('true');

    await header.trigger('click');

    expect(header.attributes('aria-expanded')).toBe('false');
  });

  it('keeps the rows mounted while the group is folded', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));
    await wrapper
      .find('[data-testid="configurator-group-header"]')
      .trigger('click');

    // Hidden, not dropped: an unsent draft and the panel's state belong to the
    // rows, and folding a group is not a reason to lose them.
    expect(wrapper.findAll('[data-testid="configurator-option"]')).toHaveLength(
      3,
    );
  });

  it('names the one chosen row while folded, and nothing while open', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));
    const summary = '[data-testid="configurator-group-summary"]';
    expect(wrapper.find(summary).exists()).toBe(false);

    await wrapper
      .find('[data-testid="configurator-group-header"]')
      .trigger('click');

    expect(wrapper.find(summary).text()).toBe('(Laminate top)');
  });

  it('says a group is empty and counts one that holds several', async () => {
    const workbench = makeInitialConfiguration();
    const accessories = findOptionGroup(workbench, 'accessories');

    const empty = mountGroup(findOptionGroup(workbench, 'color'));
    await empty
      .find('[data-testid="configurator-group-header"]')
      .trigger('click');
    expect(
      empty.find('[data-testid="configurator-group-summary"]').text(),
    ).toBe('(configurator.summary.none)');

    accessories.options[0]!.selected = true;
    accessories.options[1]!.selected = true;
    const several = mountGroup(accessories);
    await several
      .find('[data-testid="configurator-group-header"]')
      .trigger('click');
    expect(
      several.find('[data-testid="configurator-group-summary"]').text(),
    ).toBe('(configurator.summary.many)');
  });

  it('keeps a blocking message visible while the group is folded', async () => {
    const invalid = makeInvalidConfiguration();
    const top = findOptionGroup(invalid, 'top');
    top.messages = [
      { severity: 'error', text: 'That table top is out of production.' },
    ];

    const wrapper = mountGroup(top);
    await wrapper
      .find('[data-testid="configurator-group-header"]')
      .trigger('click');

    // The message is why the configuration is not finished. A buyer may fold
    // the rows away; the reason they are being asked for stays.
    expect(wrapper.find('[data-testid="configurator-message"]').text()).toBe(
      'That table top is out of production.',
    );
  });

  // ---------------------------------------------------------------------
  // The chooser: a group of more than three is chosen from a list
  // ---------------------------------------------------------------------
  it('lists a group of three inline, with no chooser', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));

    expect(wrapper.findAll('[data-testid="configurator-option"]')).toHaveLength(
      3,
    );
    expect(wrapper.find(CHOOSER).exists()).toBe(false);
    expect(wrapper.find(ADD).exists()).toBe(false);
  });

  it('offers a single choice of four from one row instead of the rows', () => {
    const wrapper = mountGroup(fourTops());

    expect(wrapper.find(CHOOSER).exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="configurator-option"]')).toHaveLength(
      0,
    );
  });

  it('offers a multi choice of four from an add row instead of the rows', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'accessories'));

    expect(wrapper.find(ADD).exists()).toBe(true);
    expect(wrapper.find(CHOOSER).exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="configurator-option"]')).toHaveLength(
      0,
    );
  });

  it('asks for a single choice and counts the rows while nothing is chosen', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'color'));

    const chooser = wrapper.find(CHOOSER);
    expect(chooser.text()).toContain('configurator.choose_in_group');
    expect(chooser.text()).toContain('configurator.option_count');
    expect(chooser.attributes('data-option-id')).toBeUndefined();
    expect(chooser.attributes('data-selected')).toBe('false');
  });

  it('shows the chosen row in the chooser: name, price and article number', () => {
    const workbench = makeInitialConfiguration();
    const colours = findOptionGroup(workbench, 'color');
    findOption(workbench, 'ral-7016').selected = true;

    const wrapper = mountGroup(colours);

    const chooser = wrapper.find(CHOOSER);
    expect(chooser.text()).toContain('Anthracite grey (RAL 7016)');
    expect(chooser.text()).toContain(
      findOption(workbench, 'ral-7016').articleNumber,
    );
    expect(
      chooser.find('[data-testid="configurator-option-price"]').text(),
    ).toMatch(/^\+.*150/);
    expect(chooser.text()).not.toContain('configurator.option_count');
    expect(chooser.attributes('data-option-id')).toBe('ral-7016');
    expect(chooser.attributes('data-selected')).toBe('true');
  });

  it('shows no price in the chooser for a chosen row that adds nothing', () => {
    const workbench = makeInitialConfiguration();
    findOption(workbench, 'ral-9005').selected = true;

    const wrapper = mountGroup(findOptionGroup(workbench, 'color'));

    expect(
      wrapper.find('[data-testid="configurator-option-price"]').exists(),
    ).toBe(false);
  });

  // The chooser row shows the price as the rows do, as sent: a discounted
  // choice carries no struck price and no percentage in either.
  it('shows a discounted chosen row at its price as sent in the chooser', () => {
    const workbench = makeInitialConfiguration();
    const chosen = findOption(workbench, 'ral-7016');
    const pegboard = findOption(workbench, 'acc-pegboard');
    chosen.selected = true;
    chosen.unitPrice = pegboard.unitPrice;
    chosen.discountPercent = pegboard.discountPercent;

    const wrapper = mountGroup(findOptionGroup(workbench, 'color'));

    const price = wrapper
      .find(CHOOSER)
      .find('[data-testid="configurator-option-price"]');
    expect(price.text()).toMatch(/^\+.*900/);
    expect(price.text()).not.toContain('1,200');
    expect(price.text()).not.toContain('%');
  });

  it('marks a chosen row the provider owns, and says why, in the chooser', () => {
    const workbench = makeInitialConfiguration();
    const chosen = findOption(workbench, 'ral-7016');
    chosen.selected = true;
    chosen.selectionSource = 'locked';

    const wrapper = mountGroup(findOptionGroup(workbench, 'color'));

    const chooser = wrapper.find(CHOOSER);
    expect(
      chooser.find('[data-testid="configurator-chooser-lock"]').exists(),
    ).toBe(true);
    expect(
      chooser.find('[data-testid="configurator-chooser-reason"]').text(),
    ).toBe('configurator.read_only');
  });

  it("gives a chosen row's blocking message as its reason in the chooser", () => {
    const workbench = makeInitialConfiguration();
    const chosen = findOption(workbench, 'ral-7016');
    chosen.selected = true;
    chosen.available = false;
    chosen.messages = [
      { severity: 'error', text: 'Not available with a steel top.' },
    ];

    const wrapper = mountGroup(findOptionGroup(workbench, 'color'));

    const reason = wrapper.find('[data-testid="configurator-chooser-reason"]');
    expect(reason.text()).toBe('Not available with a steel top.');
    expect(reason.classes()).toContain('text-destructive');
    expect(
      wrapper.find('[data-testid="configurator-chooser-lock"]').exists(),
    ).toBe(false);
  });

  it('asks for a first multi choice with nothing chosen', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'accessories'));

    expect(wrapper.find(ADD).text()).toBe('configurator.choose_in_group');
  });

  it('shows the chosen multi rows, ticked, and offers more', () => {
    const workbench = makeInitialConfiguration();
    const accessories = findOptionGroup(workbench, 'accessories');
    findOption(workbench, 'acc-light').selected = true;
    findOption(workbench, 'acc-castors').selected = true;

    const wrapper = mountGroup(accessories);

    const rows = wrapper.findAll('[data-testid="configurator-option"]');
    expect(rows.map((row) => row.attributes('data-option-id'))).toEqual([
      'acc-light',
      'acc-castors',
    ]);
    expect(
      wrapper.findAll('[role="checkbox"][aria-checked="true"]'),
    ).toHaveLength(2);
    expect(wrapper.find(ADD).text()).toBe('configurator.add_more');
  });

  it('offers nothing more once every multi row is chosen', () => {
    const workbench = makeInitialConfiguration();
    const accessories = findOptionGroup(workbench, 'accessories');
    for (const option of accessories.options) option.selected = true;

    const wrapper = mountGroup(accessories);

    expect(wrapper.findAll('[data-testid="configurator-option"]')).toHaveLength(
      4,
    );
    expect(wrapper.find(ADD).exists()).toBe(false);
  });

  it('unticks a chosen multi row on a click', async () => {
    const workbench = makeInitialConfiguration();
    const accessories = findOptionGroup(workbench, 'accessories');
    findOption(workbench, 'acc-light').selected = true;

    const wrapper = mountGroup(accessories);
    await wrapper
      .find('[data-option-id="acc-light"] [role="checkbox"]')
      .trigger('click');

    expect(wrapper.emitted('change')?.[0]?.[0]).toMatchObject({
      optionId: 'acc-light',
      selected: false,
    });
  });

  it('keeps the stepper on a chosen row of a quantity-editable group', () => {
    const workbench = makeInitialConfiguration();
    findOption(workbench, 'acc-power').selected = true;

    const wrapper = mountGroup(findOptionGroup(workbench, 'accessories'));

    expect(
      wrapper
        .find('[data-option-id="acc-power"]')
        .find('[data-testid="configurator-option-quantity"]')
        .exists(),
    ).toBe(true);
  });

  it('renders the nested groups beside a chooser', () => {
    const nested = makeNestedGroupConfiguration();
    const legs = findOptionGroup(nested, 'legs');
    legs.options.push({ ...legs.options[2]!, id: 'legs-castor' });

    const wrapper = mountGroup(legs);

    expect(wrapper.find(CHOOSER).exists()).toBe(true);
    const groups = wrapper.findAll('[data-testid="configurator-group"]');
    expect(groups.map((g) => g.attributes('data-group-id'))).toEqual([
      'legs',
      'industrial',
    ]);
    // The nested group has two rows of its own and lists them inline.
    expect(
      groups[1]!.findAll('[data-testid="configurator-option"]'),
    ).toHaveLength(2);
  });

  it('opens the panel on every row of the group from the chooser', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'color'));
    expect(wrapper.find(SHEET).exists()).toBe(false);

    await wrapper.find(CHOOSER).trigger('click');

    const sheet = wrapper.find(SHEET);
    expect(sheet.findAll('[data-testid="configurator-option"]')).toHaveLength(
      26,
    );
  });

  it('opens the panel from the add row', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'accessories'));
    await wrapper.find(ADD).trigger('click');

    expect(
      wrapper.find(SHEET).findAll('[data-testid="configurator-option"]'),
    ).toHaveLength(4);
  });

  // Opening the list sends nothing, so it stays open to a buyer while a batch
  // is in flight; the rows inside carry the lock.
  it('opens the panel while the form is locked, with its rows locked', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountComponent(ConfiguratorOptionGroup, {
      props: { group: findOptionGroup(workbench, 'color'), disabled: true },
    });
    await wrapper.find(CHOOSER).trigger('click');

    const radio = wrapper.find(
      `${SHEET} [data-option-id="ral-7016"] [role="radio"]`,
    );
    expect(radio.attributes('disabled')).toBeDefined();
  });

  it('filters the panel and says when nothing is left', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'color'));
    await wrapper.find(CHOOSER).trigger('click');

    const search = wrapper.find('[data-testid="configurator-group-search"]');
    await search.setValue('grey');
    const sheet = wrapper.find(SHEET);
    expect(sheet.findAll('[data-testid="configurator-option"]')).toHaveLength(
      4,
    );
    expect(
      wrapper.find('[data-testid="configurator-group-no-matches"]').exists(),
    ).toBe(false);

    await search.setValue('mahogany');

    expect(sheet.findAll('[data-testid="configurator-option"]')).toHaveLength(
      0,
    );
    expect(
      wrapper.find('[data-testid="configurator-group-no-matches"]').text(),
    ).toBe('configurator.no_matches');
  });

  it('emits the choice made in the panel and closes it', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'color'));
    await wrapper.find(CHOOSER).trigger('click');
    await wrapper.find(`${SHEET} [data-option-id="ral-4008"]`).trigger('click');

    expect(wrapper.emitted('change')?.[0]?.[0]).toMatchObject({
      optionId: 'ral-4008',
      selected: true,
    });
    // One choice is made once: the panel has done its job.
    expect(wrapper.find(SHEET).exists()).toBe(false);
  });

  it('keeps the panel open while several choices are made', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'accessories'));
    await wrapper.find(ADD).trigger('click');
    await wrapper
      .find(`${SHEET} [data-option-id="acc-light"]`)
      .trigger('click');

    expect(wrapper.emitted('change')).toHaveLength(1);
    expect(wrapper.find(SHEET).exists()).toBe(true);
  });
});

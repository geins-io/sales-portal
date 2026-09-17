import { describe, it, expect, vi } from 'vitest';
import { mountComponent } from '../../../utils/component';
import { OPTION_PREVIEW_LIMIT } from '../../../../app/utils/configurator-form';
import ConfiguratorOptionGroup from '../../../../app/components/product/configurator/ConfiguratorOptionGroup.vue';
import type { ConfigurationOptionGroup } from '#shared/types/configurator';
import {
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

    const wrapper = mountGroup(findOptionGroup(invalid, 'top'));
    await wrapper
      .find('[data-testid="configurator-group-header"]')
      .trigger('click');

    // The message is why the configuration is not finished. A buyer may fold
    // the rows away; the reason they are being asked for stays.
    expect(wrapper.find('[data-testid="configurator-message"]').text()).toBe(
      'Select a table top.',
    );
  });

  // ---------------------------------------------------------------------
  // The full list
  // ---------------------------------------------------------------------
  it('shows five of the twenty-six colours and offers the rest', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'color'));

    expect(wrapper.findAll('[data-testid="configurator-option"]')).toHaveLength(
      OPTION_PREVIEW_LIMIT,
    );
    expect(
      wrapper.find('[data-testid="configurator-group-show-all"]').exists(),
    ).toBe(true);
  });

  it('offers no full list for a group that fits', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));

    expect(
      wrapper.find('[data-testid="configurator-group-show-all"]').exists(),
    ).toBe(false);
  });

  it('opens the panel on every row of the group', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'color'));
    expect(
      wrapper.find('[data-testid="configurator-group-sheet"]').exists(),
    ).toBe(false);

    await wrapper
      .find('[data-testid="configurator-group-show-all"]')
      .trigger('click');

    const sheet = wrapper.find('[data-testid="configurator-group-sheet"]');
    expect(sheet.findAll('[data-testid="configurator-option"]')).toHaveLength(
      26,
    );
  });

  it('filters the panel and says when nothing is left', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'color'));
    await wrapper
      .find('[data-testid="configurator-group-show-all"]')
      .trigger('click');

    const search = wrapper.find('[data-testid="configurator-group-search"]');
    await search.setValue('grey');
    const sheet = wrapper.find('[data-testid="configurator-group-sheet"]');
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
    await wrapper
      .find('[data-testid="configurator-group-show-all"]')
      .trigger('click');
    await wrapper
      .find(
        '[data-testid="configurator-group-sheet"] [data-option-id="ral-4008"]',
      )
      .trigger('click');

    expect(wrapper.emitted('change')?.[0]?.[0]).toMatchObject({
      optionId: 'ral-4008',
      selected: true,
    });
    // One choice is made once: the panel has done its job.
    expect(
      wrapper.find('[data-testid="configurator-group-sheet"]').exists(),
    ).toBe(false);
  });

  it('keeps the panel open while several choices are made', async () => {
    const workbench = makeInitialConfiguration();
    const colours = findOptionGroup(workbench, 'color');
    // The seed has no long multi-choice group; a group that takes three is the
    // shape this rule is about, and the rows are the same rows.
    colours.maxSelections = 3;
    colours.minSelections = 0;

    const wrapper = mountGroup(colours);
    await wrapper
      .find('[data-testid="configurator-group-show-all"]')
      .trigger('click');
    await wrapper
      .find(
        '[data-testid="configurator-group-sheet"] [data-option-id="ral-4008"]',
      )
      .trigger('click');

    expect(wrapper.emitted('change')).toHaveLength(1);
    expect(
      wrapper.find('[data-testid="configurator-group-sheet"]').exists(),
    ).toBe(true);
  });
});

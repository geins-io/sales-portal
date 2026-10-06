import { describe, it, expect, vi } from 'vitest';
import { mountComponent } from '../../../utils/component';
import ConfiguratorOptionChooser from '../../../../app/components/product/configurator/ConfiguratorOptionChooser.vue';
import ConfiguratorOptionGroup from '../../../../app/components/product/configurator/ConfiguratorOptionGroup.vue';
import type {
  ConfigurationChange,
  ConfigurationOption,
  ConfigurationOptionGroup,
} from '#shared/types/configurator';
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

// The tooltip's content inline and always there, so what the icon carries can
// be read without driving the primitive. Opening it is
// ConfiguratorGroupInfo.test.ts's business.
vi.mock('../../../../app/components/ui/tooltip', () => ({
  TooltipProvider: { template: '<div><slot /></div>' },
  Tooltip: { template: '<div><slot /></div>', props: ['open'] },
  TooltipTrigger: { template: '<div><slot /></div>' },
  TooltipContent: {
    template:
      '<div data-testid="configurator-group-info-content"><slot /></div>',
  },
}));

function mountGroup(group: ConfigurationOptionGroup) {
  return mountComponent(ConfiguratorOptionGroup, { props: { group } });
}

/** The group emits a batch: everything one interaction sends, in order. */
function firstBatch(
  wrapper: ReturnType<typeof mountGroup>,
): ConfigurationChange[] | undefined {
  return wrapper.emitted('change')?.[0]?.[0] as
    | ConfigurationChange[]
    | undefined;
}

const CHOOSER = '[data-testid="configurator-group-chooser"]';
const MARK = '[data-testid="configurator-group-required"]';
const INFO = '[data-testid="configurator-group-info"]';
const ADD = '[data-testid="configurator-group-add"]';
const SHEET = '[data-testid="configurator-group-sheet"]';
const IMAGE = '[data-testid="configurator-option-image"]';
const PLACEHOLDER = '[data-testid="configurator-option-image-placeholder"]';

/** Everything the group's heading says, mark and hint included. */
function headingText(wrapper: ReturnType<typeof mountGroup>): string {
  const header = wrapper.find('[data-testid="configurator-group-header"]');
  return header.element.closest('h1, h2, h3, h4, h5, h6')!.textContent!.trim();
}

function withImage(option: ConfigurationOption, fileName: string) {
  option.product!.productImages = [{ fileName, isPrimary: false, url: '' }];
  return option;
}

/**
 * A seeded group cut down to its first option: the only shape still listed
 * inline, since every group of two or more is chosen from its list.
 */
function oneOption(groupId: string): ConfigurationOptionGroup {
  const group = findOptionGroup(makeInitialConfiguration(), groupId);
  group.options = group.options.slice(0, 1);
  return group;
}

describe('ConfiguratorOptionGroup', () => {
  it('renders a single-choice group of one as a radio group', () => {
    const wrapper = mountGroup(oneOption('top'));

    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(true);
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(1);
  });

  it('renders a multi-choice group of one as a checkbox', () => {
    const wrapper = mountGroup(oneOption('industrial'));

    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false);
    expect(wrapper.findAll('[role="checkbox"]')).toHaveLength(1);
  });

  it('keeps the checkbox of an optional multi-choice group of one, with no none row', () => {
    const group = { ...oneOption('industrial'), maxSelections: 99 };

    const wrapper = mountGroup(group);

    expect(wrapper.findAll('[role="checkbox"]')).toHaveLength(1);
    expect(
      wrapper.find('[data-testid="configurator-option-none"]').exists(),
    ).toBe(false);
  });

  it('marks a required group with an asterisk beside its title, said aloud as required', () => {
    const header = mountGroup(
      findOptionGroup(makeInitialConfiguration(), 'top'),
    ).find('[data-testid="configurator-group-header"]');
    const mark = header.find(MARK);

    expect(header.text()).toMatch(/^Table top/);
    expect(mark.classes()).toContain('text-destructive');
    expect(mark.find('[aria-hidden="true"]').text()).toBe('*');
    expect(mark.find('.sr-only').text()).toBe('configurator.required');
  });

  it("puts nothing in a required group's heading beyond its title and mark", () => {
    const wrapper = mountGroup(
      findOptionGroup(makeInitialConfiguration(), 'top'),
    );

    expect(headingText(wrapper)).toBe(
      wrapper.find('[data-testid="configurator-group-header"]').text(),
    );
  });

  it('shows no requirement on a group the provider made unavailable', () => {
    const top = {
      ...findOptionGroup(makeInitialConfiguration(), 'top'),
      available: false,
    };

    const wrapper = mountGroup(top);

    expect(wrapper.find(MARK).exists()).toBe(false);
    expect(wrapper.text()).not.toContain('configurator.required');
    expect(wrapper.text()).not.toContain('*');
  });

  it('heads an optional group with its name alone, however many it takes', () => {
    const workbench = makeInitialConfiguration();
    // Every single-choice group in this seed is also required, so the one case
    // the seed cannot show is built from the group it would otherwise be.
    const optionalSingle = {
      ...findOptionGroup(workbench, 'top'),
      minSelections: undefined,
    };
    const multi = findOptionGroup(workbench, 'accessories');

    expect(headingText(mountGroup(multi))).toBe(multi.name);
    expect(headingText(mountGroup(optionalSingle))).toBe(optionalSingle.name);
  });

  it('shows the error a rule put on a group as an icon beside its title', () => {
    // Written here rather than taken from a document: an unmet requirement is
    // a property of the group and carries no message, so a group's error is
    // always something a rule had to say.
    const invalid = makeInvalidConfiguration();
    const top = findOptionGroup(invalid, 'top');
    top.messages = [
      { severity: 'error', text: 'That table top is out of production.' },
    ];

    const wrapper = mountGroup(top);

    const info = wrapper.find(INFO);
    expect(info.attributes('data-severity')).toBe('error');
    expect(info.attributes('aria-label')).toBe('configurator.group_info');
    // In the header, after the title, and not inside the fold button.
    const header = wrapper.find('[data-testid="configurator-group-header"]');
    expect(header.find(INFO).exists()).toBe(false);
    expect(header.element.parentElement!.contains(info.element)).toBe(true);
    const message = wrapper.find('[data-testid="configurator-message"]');
    expect(message.attributes('data-severity')).toBe('error');
    expect(message.text()).toContain('That table top is out of production.');
    expect(message.element.closest('li.rounded-md')).toBeNull();
  });

  // The provider forwards a batch to Monitor in order, and Monitor does not
  // release a locked choice for a sibling pick: the deselect goes first.
  it('deselects the row it replaces first, then picks, in one batch', async () => {
    const workbench = makeInitialConfiguration();
    const top = findOptionGroup(workbench, 'top');

    const wrapper = mountGroup(top);
    await wrapper.find(CHOOSER).trigger('click');
    await wrapper
      .find(`${SHEET} [data-option-id="top-steel"] [role="radio"]`)
      .trigger('click');

    expect(wrapper.emitted('change')).toHaveLength(1);
    expect(firstBatch(wrapper)).toEqual([
      {
        type: 'option',
        optionId: 'top-laminate',
        instanceId: '0',
        selected: false,
        lock: 'none',
      },
      {
        type: 'option',
        optionId: 'top-steel',
        instanceId: '0',
        selected: true,
        lock: 'none',
      },
    ]);
  });

  it('sends the same batch from a click anywhere on a row of the panel', async () => {
    const workbench = makeInitialConfiguration();
    findOption(workbench, 'top-laminate').selectionSource = 'locked';

    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));
    await wrapper.find(CHOOSER).trigger('click');
    await wrapper
      .find(`${SHEET} [data-option-id="top-steel"]`)
      .trigger('click');

    expect(wrapper.emitted('change')).toHaveLength(1);
    expect(firstBatch(wrapper)).toMatchObject([
      { optionId: 'top-laminate', selected: false },
      { optionId: 'top-steel', selected: true },
    ]);
  });

  it('leaves a locked row in the panel open to the buyer', async () => {
    const workbench = makeInitialConfiguration();
    findOption(workbench, 'top-wood').selectionSource = 'locked';

    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));
    await wrapper.find(CHOOSER).trigger('click');

    expect(
      wrapper
        .find(`${SHEET} [data-option-id="top-wood"] [role="radio"]`)
        .attributes('disabled'),
    ).toBeUndefined();
  });

  // "No extended warranty": quantity, minimum and maximum all 0. The provider
  // refuses a 0 and is made invalid by a 1, so the pick sends none.
  it('picks a row of quantity 0 with no quantity', async () => {
    const workbench = makeInitialConfiguration();
    const top = findOptionGroup(workbench, 'top');
    Object.assign(findOption(workbench, 'top-steel'), {
      quantity: 0,
      defaultQuantity: 0,
      minQuantity: 0,
      maxQuantity: 0,
    });

    const wrapper = mountGroup(top);
    await wrapper.find(CHOOSER).trigger('click');
    await wrapper
      .find(`${SHEET} [data-option-id="top-steel"] [role="radio"]`)
      .trigger('click');

    const batch = firstBatch(wrapper) ?? [];
    expect(batch.at(-1)).toMatchObject({
      optionId: 'top-steel',
      selected: true,
    });
    for (const change of batch) expect(change).not.toHaveProperty('quantity');
  });

  it('checks the row the document says is selected', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));
    expect(wrapper.find(CHOOSER).attributes('data-option-id')).toBe(
      'top-laminate',
    );
    await wrapper.find(CHOOSER).trigger('click');

    const checked = wrapper.findAll(
      `${SHEET} [role="radio"][aria-checked="true"]`,
    );
    expect(checked).toHaveLength(1);
    expect(
      checked[0]?.element
        .closest('[data-option-id]')
        ?.getAttribute('data-option-id'),
    ).toBe('top-laminate');
  });

  it('disables the radio of a row the provider holds read-only', () => {
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
    await wrapper.find(`[data-group-id="industrial"] ${ADD}`).trigger('click');
    await wrapper
      .find(
        `[data-group-id="industrial"] ${SHEET} [data-option-id="ind-heavy"] [role="checkbox"]`,
      )
      .trigger('click');

    expect(firstBatch(wrapper)).toMatchObject([
      { optionId: 'ind-heavy', selected: true },
    ]);
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
    const accessories = findOptionGroup(workbench, 'accessories');
    findOption(workbench, 'acc-light').selected = true;

    const wrapper = mountGroup(accessories);
    await wrapper
      .find('[data-testid="configurator-group-header"]')
      .trigger('click');

    // Hidden, not dropped: an unsent draft and the panel's state belong to the
    // rows, and folding a group is not a reason to lose them.
    expect(wrapper.findAll('[data-testid="configurator-option"]')).toHaveLength(
      1,
    );
    expect(wrapper.find(ADD).exists()).toBe(true);
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

  it('keeps the icon of a blocking message in sight while the group is folded', async () => {
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
    expect(wrapper.find(INFO).isVisible()).toBe(true);
    expect(
      wrapper.find('[data-testid="configurator-message"]').text(),
    ).toContain('That table top is out of production.');
  });

  it('gives a group without messages no icon', () => {
    const wrapper = mountGroup(
      findOptionGroup(makeInitialConfiguration(), 'top'),
    );

    expect(wrapper.find(INFO).exists()).toBe(false);
  });

  it('takes the glyph and colour of each severity from the theme', () => {
    const cases = [
      ['info', 'text-muted-foreground', 'info'],
      ['warning', 'text-warning', 'triangle-alert'],
      ['error', 'text-destructive', 'circle-alert'],
    ] as const;
    for (const [severity, token, glyph] of cases) {
      const top = findOptionGroup(makeInitialConfiguration(), 'top');
      top.messages = [{ severity, text: `A ${severity}.` }];

      const info = mountGroup(top).find(INFO);

      expect(info.attributes('data-severity')).toBe(severity);
      expect(info.classes()).toContain(token);
      // The tier stubs lucide icons as a span carrying the icon's name.
      expect(info.find(`[data-name="${glyph}"]`).exists()).toBe(true);
    }
  });

  it('lists several messages under one icon, in the colour of the most severe', () => {
    const top = findOptionGroup(makeInitialConfiguration(), 'top');
    top.messages = [
      { severity: 'info', text: 'Fitted at the factory.' },
      { severity: 'warning', text: 'Long lead time.' },
    ];

    const wrapper = mountGroup(top);

    expect(wrapper.findAll(INFO)).toHaveLength(1);
    expect(wrapper.find(INFO).attributes('data-severity')).toBe('warning');
    const messages = wrapper.findAll('[data-testid="configurator-message"]');
    expect(
      messages.map((message) => message.attributes('data-severity')),
    ).toEqual(['info', 'warning']);
    // The severity is read out before each text, since the glyph alone says
    // nothing to a screen reader.
    expect(
      messages.map((message) => message.text().replace(/\s+/g, ' ')),
    ).toEqual([
      'configurator.severity.info: Fitted at the factory.',
      'configurator.severity.warning: Long lead time.',
    ]);
  });

  // ---------------------------------------------------------------------
  // The chooser: a group of more than three is chosen from a list
  // ---------------------------------------------------------------------
  it('lists a group of one inline, with no chooser', () => {
    const wrapper = mountGroup(oneOption('top'));

    expect(wrapper.findAll('[data-testid="configurator-option"]')).toHaveLength(
      1,
    );
    expect(wrapper.find(CHOOSER).exists()).toBe(false);
    expect(wrapper.find(ADD).exists()).toBe(false);
  });

  it('offers a multi choice of two from an add row', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'industrial'));

    expect(wrapper.find(ADD).exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="configurator-option"]')).toHaveLength(
      0,
    );
  });

  it('offers a single choice of three from one row instead of the rows', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));

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

    // The heading above already names the group, so the prompt does not.
    const chooser = wrapper.find(CHOOSER);
    expect(chooser.text()).toMatch(/configurator\.choose(?!_)/);
    expect(chooser.text()).not.toContain('configurator.choose_in_group');
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

  // Centred at the right edge like the option rows, not on the name's line as
  // the prototype has it.
  it('puts the chosen price on the centre line at the right, before the chevron', () => {
    const workbench = makeInitialConfiguration();
    findOption(workbench, 'top-laminate').selected = false;
    findOption(workbench, 'top-wood').selected = true;

    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));

    const chooser = wrapper.find(CHOOSER).element;
    const price = wrapper
      .find(CHOOSER)
      .find('[data-testid="configurator-option-price"]').element;
    // On the row's own line, and followed only by the chevron.
    expect(price.parentElement).toBe(chooser);
    expect(price.nextElementSibling).toBe(chooser.lastElementChild);
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

  it('marks a chosen row the provider holds read-only, and says why, in the chooser', () => {
    const workbench = makeInitialConfiguration();
    const chosen = findOption(workbench, 'ral-7016');
    chosen.selected = true;
    chosen.readOnly = true;

    const wrapper = mountGroup(findOptionGroup(workbench, 'color'));

    const chooser = wrapper.find(CHOOSER);
    expect(
      chooser.find('[data-testid="configurator-chooser-lock"]').exists(),
    ).toBe(true);
    expect(
      chooser.find('[data-testid="configurator-chooser-reason"]').text(),
    ).toBe('configurator.read_only');
  });

  it('marks nothing on a chosen row that is only locked, in the chooser', () => {
    const workbench = makeInitialConfiguration();
    const chosen = findOption(workbench, 'ral-7016');
    chosen.selected = true;
    chosen.selectionSource = 'locked';

    const chooser = mountGroup(findOptionGroup(workbench, 'color')).find(
      CHOOSER,
    );
    expect(
      chooser.find('[data-testid="configurator-chooser-lock"]').exists(),
    ).toBe(false);
    expect(
      chooser.find('[data-testid="configurator-chooser-reason"]').exists(),
    ).toBe(false);
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

    expect(wrapper.find(ADD).text()).toBe('configurator.choose');
  });

  it('names the group in the panel title, where its heading is out of sight', async () => {
    const workbench = makeInitialConfiguration();

    for (const id of ['color', 'accessories']) {
      const wrapper = mountGroup(findOptionGroup(workbench, id));
      await wrapper.find(`${CHOOSER}, ${ADD}`).trigger('click');

      expect(wrapper.find('[data-testid="sheet-title"]').text()).toBe(
        'configurator.choose_in_group',
      );
    }
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

    const batch = firstBatch(wrapper);
    expect(batch).toMatchObject([{ optionId: 'acc-light', selected: false }]);
    expect(batch?.[0]).not.toHaveProperty('quantity');
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

  it('renders the nested groups beside a chooser, each deciding for its own rows', () => {
    const nested = makeNestedGroupConfiguration();
    const legs = findOptionGroup(nested, 'legs');
    findOptionGroup(nested, 'industrial').options.splice(1);

    const wrapper = mountGroup(legs);

    expect(wrapper.find(CHOOSER).exists()).toBe(true);
    const groups = wrapper.findAll('[data-testid="configurator-group"]');
    expect(groups.map((g) => g.attributes('data-group-id'))).toEqual([
      'legs',
      'industrial',
    ]);
    // Cut down to one row, the nested group lists it inline.
    expect(
      groups[1]!.findAll('[data-testid="configurator-option"]'),
    ).toHaveLength(1);
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

    expect(firstBatch(wrapper)).toMatchObject([
      { optionId: 'ral-4008', selected: true },
    ]);
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

  // ---------------------------------------------------------------------
  // The image column: decided per group, from the group's own options
  // ---------------------------------------------------------------------
  it('shows no image box anywhere in a group where no option has an image', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));
    expect(wrapper.find(CHOOSER).find(IMAGE).exists()).toBe(false);
    await wrapper.find(CHOOSER).trigger('click');

    expect(wrapper.find(SHEET).findAll(IMAGE)).toHaveLength(0);
  });

  it('gives every row a box when one option has an image, a placeholder where it is missing', async () => {
    const workbench = makeInitialConfiguration();
    withImage(findOption(workbench, 'top-wood'), 'beech.jpg');

    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));
    await wrapper.find(CHOOSER).trigger('click');

    const sheet = wrapper.find(SHEET);
    expect(sheet.findAll(IMAGE)).toHaveLength(3);
    expect(sheet.findAll(PLACEHOLDER)).toHaveLength(2);
    expect(
      sheet
        .find('[data-option-id="top-wood"]')
        .findComponent({ name: 'GeinsImage' })
        .props('fileName'),
    ).toBe('beech.jpg');
  });

  it('shows an image on every row when every option has one', async () => {
    const workbench = makeInitialConfiguration();
    for (const option of findOptionGroup(workbench, 'top').options) {
      withImage(option, `${option.id}.jpg`);
    }

    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));
    await wrapper.find(CHOOSER).trigger('click');

    const sheet = wrapper.find(SHEET);
    expect(sheet.findAll(IMAGE)).toHaveLength(3);
    expect(sheet.findAll(PLACEHOLDER)).toHaveLength(0);
  });

  it("shows the chosen option's image in the chooser row", () => {
    const workbench = makeInitialConfiguration();
    withImage(findOption(workbench, 'top-laminate'), 'laminate.jpg');

    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));

    const chooser = wrapper.find(CHOOSER);
    expect(
      chooser.findComponent({ name: 'GeinsImage' }).props('fileName'),
    ).toBe('laminate.jpg');
    expect(chooser.find(PLACEHOLDER).exists()).toBe(false);
  });

  it('shows the placeholder in the chooser row for a chosen option without an image', () => {
    const workbench = makeInitialConfiguration();
    withImage(findOption(workbench, 'top-wood'), 'beech.jpg');

    // Laminate, preselected by the provider, has no image of its own.
    const wrapper = mountGroup(findOptionGroup(workbench, 'top'));

    expect(wrapper.find(CHOOSER).find(PLACEHOLDER).exists()).toBe(true);
  });

  it('shows the placeholder in the chooser row while nothing is chosen', () => {
    const workbench = makeInitialConfiguration();
    withImage(findOption(workbench, 'ral-7016'), 'anthracite.jpg');

    const wrapper = mountGroup(findOptionGroup(workbench, 'color'));

    expect(wrapper.find(CHOOSER).find(PLACEHOLDER).exists()).toBe(true);
  });

  it('gives the chosen rows of a multi choice the column too', () => {
    const workbench = makeInitialConfiguration();
    withImage(findOption(workbench, 'acc-light'), 'light.jpg');
    findOption(workbench, 'acc-castors').selected = true;

    const wrapper = mountGroup(findOptionGroup(workbench, 'accessories'));

    expect(
      wrapper.find('[data-option-id="acc-castors"]').find(PLACEHOLDER).exists(),
    ).toBe(true);
  });

  it('gives a lone inline row the column when it has an image', () => {
    const group = oneOption('top');
    withImage(group.options[0]!, 'laminate.jpg');

    const wrapper = mountGroup(group);

    expect(wrapper.findAll(IMAGE)).toHaveLength(1);
    expect(wrapper.findComponent({ name: 'GeinsImage' }).exists()).toBe(true);
  });

  it("decides a nested group's column from its own options", () => {
    const nested = makeNestedGroupConfiguration();
    withImage(findOption(nested, 'legs-fixed'), 'legs.jpg');
    findOptionGroup(nested, 'industrial').options.splice(1);

    const wrapper = mountGroup(findOptionGroup(nested, 'legs'));

    const groups = wrapper.findAll('[data-testid="configurator-group"]');
    expect(groups[0]!.find(CHOOSER).find(IMAGE).exists()).toBe(true);
    expect(groups[1]!.find(IMAGE).exists()).toBe(false);
  });

  // ---------------------------------------------------------------------
  // "Inget valt": an optional single choice leads with "nothing chosen"
  // ---------------------------------------------------------------------
  describe('an option with neither a name nor an article number', () => {
    const ROW = '[data-testid="configurator-option"]';

    function blank(
      from: ConfigurationOption,
      parts: Partial<ConfigurationOption> = {},
    ): ConfigurationOption {
      return {
        ...from,
        id: 'blank',
        name: '',
        articleNumber: '',
        selected: false,
        ...parts,
      };
    }

    /** The seeded table top, with a blank row added after its real ones. */
    function topWithBlank(parts: Partial<ConfigurationOption> = {}) {
      const top = findOptionGroup(makeInitialConfiguration(), 'top');
      for (const option of top.options) option.selected = false;
      top.options.push(blank(top.options[0]!, parts));
      return top;
    }

    it('is left out of the panel, its search and its count', async () => {
      const top = topWithBlank();
      const wrapper = mountGroup(top);

      expect(
        wrapper.findComponent(ConfiguratorOptionChooser).props('count'),
      ).toBe(top.options.length - 1);
      await wrapper.find(CHOOSER).trigger('click');

      const ids = wrapper
        .find(SHEET)
        .findAll(ROW)
        .map((row) => row.attributes('data-option-id'));
      expect(ids).toHaveLength(top.options.length - 1);
      expect(ids).not.toContain('blank');
    });

    it('does not count toward the chooser decision', () => {
      const top = findOptionGroup(makeInitialConfiguration(), 'top');
      top.options = [top.options[0]!, blank(top.options[0]!)];

      const wrapper = mountGroup(top);

      // One real row: listed inline, as a group of one is.
      expect(wrapper.find(CHOOSER).exists()).toBe(false);
      expect(wrapper.findAll(ROW)).toHaveLength(1);
    });

    it('does not keep a group from saying it has nothing to choose', () => {
      const top = findOptionGroup(makeInitialConfiguration(), 'top');
      for (const option of top.options) {
        option.available = false;
        option.selected = false;
        option.messages = [];
      }
      top.options.push(blank(top.options[0]!, { available: true }));

      const wrapper = mountGroup(top);

      expect(wrapper.find(CHOOSER).text()).toContain(
        'configurator.nothing_to_choose',
      );
    });

    it('is listed, and checked, when the provider has it selected', async () => {
      const top = topWithBlank({ selected: true });

      const wrapper = mountGroup(top);
      await wrapper.find(CHOOSER).trigger('click');

      const row = wrapper.find(`${SHEET} ${ROW}[data-option-id="blank"]`);
      expect(row.exists()).toBe(true);
      expect(row.find('[role="radio"]').attributes('aria-checked')).toBe(
        'true',
      );
    });

    it('says there is nothing to choose when every option is blank', () => {
      const top = findOptionGroup(makeInitialConfiguration(), 'top');
      top.options = top.options.map((option) =>
        blank(option, { id: option.id }),
      );

      const wrapper = mountGroup(top);

      // Nothing to list leaves no chooser: the line stands where the rows
      // would, as it does under a lone row.
      expect(wrapper.findAll(ROW)).toHaveLength(0);
      expect(
        wrapper.find('[data-testid="configurator-group-nothing"]').text(),
      ).toBe('configurator.nothing_to_choose');
    });
  });

  describe('a group with nothing to choose', () => {
    const NOTHING = '[data-testid="configurator-group-nothing"]';
    const REASON = '[data-testid="configurator-option-reason"]';

    function unavailableTop() {
      const workbench = makeInitialConfiguration();
      const top = findOptionGroup(workbench, 'top');
      top.available = false;
      for (const option of top.options) option.selected = false;
      return top;
    }

    it('says so in the chooser instead of asking for a choice and counting', () => {
      const wrapper = mountGroup(unavailableTop());

      const chooser = wrapper.find(CHOOSER);
      expect(chooser.text()).toContain('configurator.nothing_to_choose');
      expect(chooser.text()).not.toContain('configurator.choose_in_group');
      expect(chooser.text()).not.toContain('configurator.option_count');
    });

    it('still opens, every row disabled with its reason', async () => {
      const top = unavailableTop();
      const wrapper = mountGroup(top);

      await wrapper.find(CHOOSER).trigger('click');

      const rows = wrapper
        .find(SHEET)
        .findAll('[data-testid="configurator-option"]');
      expect(rows).toHaveLength(top.options.length);
      for (const row of rows) {
        expect(row.find('[role="radio"]').attributes('disabled')).toBeDefined();
        expect(row.find(REASON).text()).toBe('configurator.unavailable');
      }
    });

    it('reads the same when the group is available but every row is not', async () => {
      const workbench = makeInitialConfiguration();
      const top = findOptionGroup(workbench, 'top');
      for (const option of top.options) {
        option.available = false;
        option.selected = false;
        option.messages = [];
      }

      const wrapper = mountGroup(top);
      expect(wrapper.find(CHOOSER).text()).toContain(
        'configurator.nothing_to_choose',
      );

      await wrapper.find(CHOOSER).trigger('click');
      const rows = wrapper
        .find(SHEET)
        .findAll('[data-testid="configurator-option"]');
      expect(rows).toHaveLength(top.options.length);
      for (const row of rows) {
        expect(row.find(REASON).text()).toBe('configurator.unavailable');
      }
    });

    it('asks for a choice while one row is still available', () => {
      const workbench = makeInitialConfiguration();
      const top = findOptionGroup(workbench, 'top');
      for (const option of top.options.slice(1)) option.available = false;

      const wrapper = mountGroup(top);

      expect(wrapper.find(CHOOSER).text()).not.toContain(
        'configurator.nothing_to_choose',
      );
    });

    it('says so on the add row of a multi choice, which still opens', async () => {
      const workbench = makeInitialConfiguration();
      const accessories = findOptionGroup(workbench, 'accessories');
      accessories.available = false;

      const wrapper = mountGroup(accessories);
      expect(wrapper.find(ADD).text()).toBe('configurator.nothing_to_choose');

      await wrapper.find(ADD).trigger('click');
      const rows = wrapper
        .find(SHEET)
        .findAll('[data-testid="configurator-option"]');
      expect(rows).toHaveLength(accessories.options.length);
      for (const row of rows) {
        expect(row.find(REASON).text()).toBe('configurator.unavailable');
      }
    });

    it('says so under a lone row, which gives its reason', () => {
      const top = oneOption('top');
      top.available = false;

      const wrapper = mountGroup(top);

      expect(wrapper.find(NOTHING).text()).toBe(
        'configurator.nothing_to_choose',
      );
      expect(wrapper.find(REASON).text()).toBe('configurator.unavailable');
    });

    it('says nothing under a lone row the buyer may choose', () => {
      const wrapper = mountGroup(oneOption('top'));

      expect(wrapper.find(NOTHING).exists()).toBe(false);
    });

    it('says so rather than "nothing chosen" in an optional single choice', () => {
      const top = unavailableTop();
      top.minSelections = undefined;

      const wrapper = mountGroup(top);

      const chooser = wrapper.find(CHOOSER);
      expect(chooser.text()).toContain('configurator.nothing_to_choose');
      expect(chooser.text()).not.toContain('configurator.none_option');
      expect(chooser.attributes('data-none')).toBe('false');
    });

    it('keeps showing an option already chosen, with its reason', () => {
      const top = unavailableTop();
      const first = top.options[0]!;
      first.selected = true;

      const wrapper = mountGroup(top);

      const chooser = wrapper.find(CHOOSER);
      expect(chooser.attributes('data-option-id')).toBe(first.id);
      expect(chooser.text()).toContain(first.name);
      expect(chooser.text()).not.toContain('configurator.nothing_to_choose');
      expect(
        chooser.find('[data-testid="configurator-chooser-reason"]').text(),
      ).toBe('configurator.unavailable');
    });

    it('gives the rows of a group nested in an unavailable one their reason', () => {
      const nested = makeNestedGroupConfiguration();
      const legs = findOptionGroup(nested, 'legs');
      legs.available = false;
      const industrial = findOptionGroup(nested, 'industrial');
      industrial.options.splice(1);

      const wrapper = mountGroup(legs);

      const inner = wrapper.find('[data-group-id="industrial"]');
      expect(inner.find(REASON).text()).toBe('configurator.unavailable');
      expect(
        inner.find('[role="checkbox"]').attributes('disabled'),
      ).toBeDefined();
    });

    it('gives no reason while the form is locked for a batch', async () => {
      const wrapper = mountComponent(ConfiguratorOptionGroup, {
        props: { group: unavailableTop(), disabled: true },
      });

      await wrapper.find(CHOOSER).trigger('click');

      const sheet = wrapper.find(SHEET);
      expect(
        sheet.findAll('[data-testid="configurator-option"]').length,
      ).toBeGreaterThan(0);
      expect(sheet.find(REASON).exists()).toBe(false);
    });
  });

  describe('an optional single choice', () => {
    const NONE = `${SHEET} [data-testid="configurator-option-none"]`;

    /** The seeded table top, made optional. */
    function optionalTop(chosenId?: string) {
      const workbench = makeInitialConfiguration();
      const top = findOptionGroup(workbench, 'top');
      top.minSelections = undefined;
      for (const option of top.options)
        option.selected = option.id === chosenId;
      return { workbench, top };
    }

    it('reads "nothing chosen" in the chooser while nothing is chosen', () => {
      const { top } = optionalTop();

      const chooser = mountGroup(top).find(CHOOSER);

      expect(chooser.text()).toContain('configurator.none_option');
      expect(chooser.text()).not.toContain('configurator.choose_in_group');
      expect(chooser.text()).not.toContain('configurator.option_count');
      expect(chooser.attributes('data-none')).toBe('true');
      expect(chooser.attributes('data-selected')).toBe('false');
    });

    // Green means a real choice; "nothing chosen" is none.
    it('marks "nothing chosen" in the chooser without the selected colour', () => {
      const { top } = optionalTop();

      const chooser = mountGroup(top).find(CHOOSER);

      expect(chooser.classes()).not.toContain('border-selected/60');
      expect(chooser.classes()).not.toContain('bg-selected/5');
    });

    it('keeps the selected colour on a real chosen option in the same group', () => {
      const { top } = optionalTop(
        findOptionGroup(makeInitialConfiguration(), 'top').options[0]!.id,
      );

      const chooser = mountGroup(top).find(CHOOSER);

      expect(chooser.classes()).toContain('border-selected/60');
      expect(chooser.classes()).toContain('bg-selected/5');
    });

    it('gives the "nothing chosen" row in the sheet no selected colour, checked or not', async () => {
      for (const chosenId of [
        undefined,
        findOptionGroup(makeInitialConfiguration(), 'top').options[0]!.id,
      ]) {
        const { top } = optionalTop(chosenId);
        const wrapper = mountGroup(top);
        await wrapper.find(CHOOSER).trigger('click');

        const row = wrapper.find(NONE);
        expect(row.attributes('data-selected')).toBe(String(!chosenId));
        expect(row.classes()).not.toContain('border-selected/60');
        expect(row.classes()).not.toContain('bg-selected/5');
        const radio = row.find('[role="radio"]');
        expect(radio.attributes('aria-checked')).toBe(String(!chosenId));
        expect(radio.classes().join(' ')).not.toContain('selected');
      }
    });

    it('lists "nothing chosen" first in the sheet, and checked', async () => {
      const { top } = optionalTop();

      const wrapper = mountGroup(top);
      await wrapper.find(CHOOSER).trigger('click');

      const radios = wrapper.findAll(`${SHEET} [role="radio"]`);
      expect(radios).toHaveLength(4);
      expect(wrapper.find(`${NONE} [role="radio"]`).element).toBe(
        radios[0]!.element,
      );
      expect(radios[0]!.attributes('aria-checked')).toBe('true');
      expect(
        wrapper.findAll(`${SHEET} [role="radio"][aria-checked="true"]`),
      ).toHaveLength(1);
      expect(wrapper.find(NONE).text()).toBe('configurator.none_option');
    });

    it('sends nothing when "nothing chosen" is chosen again', async () => {
      const { top } = optionalTop();

      const wrapper = mountGroup(top);
      await wrapper.find(CHOOSER).trigger('click');
      await wrapper.find(NONE).trigger('click');

      expect(wrapper.emitted('change')).toBeUndefined();
      expect(wrapper.find(SHEET).exists()).toBe(false);
    });

    it('shows the chosen option in the chooser, and leaves "nothing chosen" unchecked', async () => {
      const { top } = optionalTop('top-wood');

      const wrapper = mountGroup(top);
      const chooser = wrapper.find(CHOOSER);
      expect(chooser.attributes('data-option-id')).toBe('top-wood');
      expect(chooser.attributes('data-none')).toBe('false');
      expect(chooser.text()).not.toContain('configurator.none_option');

      await chooser.trigger('click');
      expect(
        wrapper.find(`${NONE} [role="radio"]`).attributes('aria-checked'),
      ).toBe('false');
    });

    it('deselects the chosen option in one change when "nothing chosen" is chosen', async () => {
      const { top } = optionalTop('top-wood');

      const wrapper = mountGroup(top);
      await wrapper.find(CHOOSER).trigger('click');
      await wrapper.find(`${NONE} [role="radio"]`).trigger('click');

      expect(wrapper.emitted('change')).toHaveLength(1);
      expect(firstBatch(wrapper)).toEqual([
        {
          type: 'option',
          optionId: 'top-wood',
          instanceId: '0',
          selected: false,
          lock: 'none',
        },
      ]);
      // A single choice is made once, "nothing chosen" included.
      expect(wrapper.find(SHEET).exists()).toBe(false);
    });

    it('deselects from a click anywhere on the row, once', async () => {
      const { top } = optionalTop('top-wood');

      const wrapper = mountGroup(top);
      await wrapper.find(CHOOSER).trigger('click');
      await wrapper.find(NONE).trigger('click');

      expect(wrapper.emitted('change')).toHaveLength(1);
      expect(firstBatch(wrapper)).toMatchObject([
        { optionId: 'top-wood', selected: false },
      ]);
    });

    it('deselects a locked choice, which the provider lets the buyer undo', async () => {
      const { top } = optionalTop('top-wood');
      top.options[1]!.selectionSource = 'locked';

      const wrapper = mountGroup(top);
      await wrapper.find(CHOOSER).trigger('click');
      await wrapper.find(`${NONE} [role="radio"]`).trigger('click');

      expect(firstBatch(wrapper)).toMatchObject([
        { optionId: 'top-wood', selected: false },
      ]);
    });

    it('cannot deselect an option the provider holds read-only', async () => {
      const { top } = optionalTop('top-wood');
      top.options[1]!.readOnly = true;

      const wrapper = mountGroup(top);
      await wrapper.find(CHOOSER).trigger('click');
      expect(
        wrapper.find(`${NONE} [role="radio"]`).attributes('disabled'),
      ).toBeDefined();
      await wrapper.find(NONE).trigger('click');

      expect(wrapper.emitted('change')).toBeUndefined();
    });

    it('gives "nothing chosen" no image box where the other rows carry one', async () => {
      const { workbench, top } = optionalTop();
      withImage(findOption(workbench, 'top-wood'), 'beech.jpg');

      const wrapper = mountGroup(top);
      expect(wrapper.find(CHOOSER).find(IMAGE).exists()).toBe(false);
      await wrapper.find(CHOOSER).trigger('click');

      expect(wrapper.find(NONE).find(IMAGE).exists()).toBe(false);
      expect(wrapper.find(SHEET).findAll(IMAGE)).toHaveLength(3);
    });

    it('finds "nothing chosen" by its label, and drops it from other searches', async () => {
      const { top } = optionalTop();

      const wrapper = mountGroup(top);
      await wrapper.find(CHOOSER).trigger('click');
      const search = wrapper.find('[data-testid="configurator-group-search"]');

      await search.setValue('beech');
      expect(wrapper.find(NONE).exists()).toBe(false);

      await search.setValue('none_option');
      expect(wrapper.find(NONE).exists()).toBe(true);
      expect(
        wrapper.find('[data-testid="configurator-group-no-matches"]').exists(),
      ).toBe(false);
    });

    it('says "nothing chosen" while folded', async () => {
      const { top } = optionalTop();

      const wrapper = mountGroup(top);
      await wrapper
        .find('[data-testid="configurator-group-header"]')
        .trigger('click');

      expect(
        wrapper.find('[data-testid="configurator-group-summary"]').text(),
      ).toBe('(configurator.none_option)');
    });

    // One real option and "nothing chosen" is a choice of two.
    it('opens a group of one real option from the chooser', () => {
      const { top } = optionalTop();
      top.options = top.options.slice(0, 1);

      const wrapper = mountGroup(top);

      expect(wrapper.find(CHOOSER).exists()).toBe(true);
      expect(
        wrapper.findAll('[data-testid="configurator-option"]'),
      ).toHaveLength(0);
    });
  });

  it('gives a required single choice no "nothing chosen"', async () => {
    const workbench = makeInitialConfiguration();
    const top = findOptionGroup(workbench, 'top');
    for (const option of top.options) option.selected = false;

    const wrapper = mountGroup(top);
    const chooser = wrapper.find(CHOOSER);
    expect(chooser.text()).toMatch(/configurator\.choose(?!_)/);
    expect(chooser.attributes('data-none')).toBe('false');
    await chooser.trigger('click');

    expect(
      wrapper
        .find(`${SHEET} [data-testid="configurator-option-none"]`)
        .exists(),
    ).toBe(false);
    expect(wrapper.findAll(`${SHEET} [role="radio"]`)).toHaveLength(3);
  });

  // ---------------------------------------------------------------------
  // A refused change
  // ---------------------------------------------------------------------
  const REFUSED = '[data-testid="configurator-change-refused"]';

  function pickOf(optionId: string, instanceId = '0') {
    return {
      type: 'option',
      optionId,
      instanceId,
      selected: true,
      quantity: 1,
      lock: 'none',
    } as const;
  }

  it('says the choice was not accepted when one of its options was refused', () => {
    const workbench = makeInitialConfiguration();
    const legs = findOptionGroup(workbench, 'legs');
    const refused = pickOf('legs-electric', legs.options[2]!.instanceId);

    const wrapper = mountComponent(ConfiguratorOptionGroup, {
      props: { group: legs, refused },
    });

    expect(wrapper.find(REFUSED).text()).toBe(
      'configurator.change_refused_option',
    );
  });

  it("says nothing about another group's refused option", () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountComponent(ConfiguratorOptionGroup, {
      props: {
        group: findOptionGroup(workbench, 'legs'),
        refused: pickOf('top-oak'),
      },
    });

    expect(wrapper.find(REFUSED).exists()).toBe(false);
  });

  it('lets a nested group answer for its own option, and only it', () => {
    const nested = makeNestedGroupConfiguration();
    const industrial = findOptionGroup(nested, 'industrial');
    const refused = pickOf('ind-heavy', industrial.options[1]!.instanceId);

    const wrapper = mountComponent(ConfiguratorOptionGroup, {
      props: { group: findOptionGroup(nested, 'legs'), refused },
    });

    const lines = wrapper.findAll(REFUSED);
    expect(lines).toHaveLength(1);
    expect(
      wrapper.find(`[data-group-id="industrial"] ${REFUSED}`).exists(),
    ).toBe(true);
  });
});

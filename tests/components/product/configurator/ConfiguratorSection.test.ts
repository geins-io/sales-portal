import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../../utils/component';
import ConfiguratorSection from '../../../../app/components/product/configurator/ConfiguratorSection.vue';
import type { ConfigurationSection } from '#shared/types/configurator';
import {
  findOption,
  makeCabinetConfiguration,
  makeInitialConfiguration,
} from '../../../fixtures/configurator';

function sectionOf(
  sections: ConfigurationSection[],
  id: string,
): ConfigurationSection {
  const section = sections.find((candidate) => candidate.id === id);
  if (!section) throw new Error(`No section '${id}' in the configuration`);
  return section;
}

function mountSection(section: ConfigurationSection) {
  return mountComponent(ConfiguratorSection, { props: { section } });
}

describe('ConfiguratorSection', () => {
  it('renders nothing for a section the provider marked invisible', () => {
    const cabinet = makeCabinetConfiguration();
    const logistics = sectionOf(cabinet.sections, 'logistics');

    const wrapper = mountSection(logistics);

    expect(wrapper.find('[data-testid="configurator-section"]').exists()).toBe(
      false,
    );
    // The hidden section's only variable must not leak through either.
    expect(wrapper.text()).not.toContain('Pallet code');
  });

  it('renders a visible section with its variables', () => {
    const cabinet = makeCabinetConfiguration();

    const wrapper = mountSection(sectionOf(cabinet.sections, 'cabinet'));

    expect(
      wrapper.findAll('[data-testid="configurator-variable"]'),
    ).toHaveLength(3);
  });

  it('leaves out a variable the provider made unavailable, row and all', () => {
    const cabinet = makeCabinetConfiguration();
    const section = sectionOf(cabinet.sections, 'cabinet');
    section.variables[0]!.available = false;
    const hidden = section.variables[0]!.id;

    const wrapper = mountSection(section);

    // The row goes with the field, or its rule is left behind on its own.
    expect(
      wrapper.findAll('[data-testid="configurator-variable-row"]'),
    ).toHaveLength(2);
    expect(wrapper.find(`[data-variable-id="${hidden}"]`).exists()).toBe(false);
  });

  it('shows the variable once a choice makes it available, and hides it again', async () => {
    const cabinet = makeCabinetConfiguration();
    const closed = structuredClone(sectionOf(cabinet.sections, 'cabinet'));
    closed.variables[0]!.available = false;
    const open = sectionOf(cabinet.sections, 'cabinet');
    const id = open.variables[0]!.id;

    const wrapper = mountSection(closed);
    expect(wrapper.find(`[data-variable-id="${id}"]`).exists()).toBe(false);

    await wrapper.setProps({ section: open });
    expect(wrapper.find(`[data-variable-id="${id}"]`).exists()).toBe(true);

    await wrapper.setProps({ section: closed });
    expect(wrapper.find(`[data-variable-id="${id}"]`).exists()).toBe(false);
  });

  it('writes no heading of its own, because the page numbers the section', () => {
    const cabinet = makeCabinetConfiguration();

    const wrapper = mountSection(sectionOf(cabinet.sections, 'cabinet'));

    // The rail gives the section its number and the page renders the `h4` that
    // carries it; a second heading here would say the name twice.
    expect(wrapper.text()).not.toContain('Cabinet');
    expect(wrapper.find('h4').exists()).toBe(false);
  });

  it('renders its members in the order the indices give', () => {
    const cabinet = makeCabinetConfiguration();

    const wrapper = mountSection(sectionOf(cabinet.sections, 'cabinet'));

    // The seed interleaves this section: a list, two fields, a list, a field.
    // Neither of the document's two arrays can express that on its own, which
    // is the whole reason `sortIndex` exists.
    expect(
      wrapper
        .findAll(
          '[data-testid="configurator-group"], [data-testid="configurator-variable"]',
        )
        .map(
          (node) =>
            node.attributes('data-group-id') ??
            node.attributes('data-variable-id'),
        ),
    ).toEqual(['mount', 'cab-width', 'cab-height', 'doors', 'front-area']);
  });

  it('writes no heading over the fields', () => {
    const cabinet = makeCabinetConfiguration();

    const wrapper = mountSection(sectionOf(cabinet.sections, 'cabinet'));

    // A variable is the section's own field and the section is already named;
    // any heading here would claim something about content `valueType` does
    // not carry. Once the fields are interleaved among the lists there is no
    // block for one to sit over anyway.
    expect(
      wrapper.find('[data-testid="configurator-measurements"]').exists(),
    ).toBe(false);
    expect(wrapper.text()).not.toContain('configurator.measurements');
  });

  it('gives every field a row of its own, never a shared grid', () => {
    const cabinet = makeCabinetConfiguration();

    const wrapper = mountSection(sectionOf(cabinet.sections, 'cabinet'));

    // A date, a free text and a measurement side by side would say they belong
    // together. They are the section's own fields and nothing more, so each one
    // gets a rule and air of its own across the full width.
    const rows = wrapper.findAll('[data-testid="configurator-variable-row"]');

    expect(rows).toHaveLength(
      wrapper.findAll('[data-testid="configurator-variable"]').length,
    );
    expect(
      rows.map(
        (row) => row.findAll('[data-testid="configurator-variable"]').length,
      ),
    ).toEqual(rows.map(() => 1));
    expect(
      wrapper.find('[data-testid="configurator-variables"]').exists(),
    ).toBe(false);
  });

  it('renders its own content only, never a child section\u2019s', () => {
    const workbench = makeInitialConfiguration();

    // `Finish` sits inside `Frame` and is an entry of its own in the rail.
    // Rendering it here would put its content on two pages at once.
    const wrapper = mountSection(sectionOf(workbench.sections, 'frame'));

    expect(
      wrapper
        .findAll('[data-testid="configurator-section"]')
        .map((s) => s.attributes('data-section-id')),
    ).toEqual(['frame']);
    expect(
      wrapper
        .findAll('[data-testid="configurator-group"]')
        .map((g) => g.attributes('data-group-id')),
    ).toEqual(['legs', 'industrial']);
  });

  it('puts a group one level under the heading the page renders', () => {
    const workbench = makeInitialConfiguration();

    // The page's section heading is an `h4`, so a group never outranks the
    // section it belongs to.
    const wrapper = mountSection(sectionOf(workbench.sections, 'frame'));

    expect(wrapper.find('[data-group-id="legs"] h5').text()).toContain(
      'Leg frame',
    );
  });

  it('renders every node of the section it was given, and nothing invented', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountSection(sectionOf(workbench.sections, 'frame'));

    // Four variables and two groups. Both groups hold more than one option,
    // so each is chosen from its list: the single choice by its chooser row,
    // the multi choice, with nothing chosen yet, by its add row.
    expect(
      wrapper.findAll('[data-testid="configurator-variable"]'),
    ).toHaveLength(4);
    expect(wrapper.findAll('[data-testid="configurator-group"]')).toHaveLength(
      2,
    );
    expect(
      wrapper.findAll('[data-testid="configurator-group-chooser"]'),
    ).toHaveLength(1);
    expect(
      wrapper.findAll('[data-testid="configurator-group-add"]'),
    ).toHaveLength(1);
  });

  it('passes a change from a group up untouched', async () => {
    const workbench = makeInitialConfiguration();
    // A chosen multi row stays on the page, where a click unticks it.
    findOption(workbench, 'ind-esd').selected = true;

    const wrapper = mountSection(sectionOf(workbench.sections, 'frame'));
    await wrapper
      .find('[data-option-id="ind-esd"] button[role="checkbox"]')
      .trigger('click');

    expect(wrapper.emitted('change')?.[0]?.[0]).toMatchObject({
      type: 'option',
      optionId: 'ind-esd',
      selected: false,
    });
  });

  it('hands a refused change to the field and the group it was aimed at', () => {
    const workbench = makeInitialConfiguration();
    const frame = sectionOf(workbench.sections, 'frame');
    const REFUSED = '[data-testid="configurator-change-refused"]';

    const onField = mountComponent(ConfiguratorSection, {
      props: {
        section: frame,
        refused: { type: 'variable', variableId: 'depth', value: 0 },
      },
    });
    expect(onField.find(`[data-variable-id="depth"] ${REFUSED}`).exists()).toBe(
      true,
    );
    expect(onField.findAll(REFUSED)).toHaveLength(1);

    const legs = findOption(workbench, 'legs-manual');
    const onGroup = mountComponent(ConfiguratorSection, {
      props: {
        section: frame,
        refused: {
          type: 'option',
          optionId: legs.id,
          instanceId: legs.instanceId,
          selected: true,
          quantity: 1,
          lock: 'none',
        },
      },
    });
    expect(onGroup.find(`[data-group-id="legs"] ${REFUSED}`).exists()).toBe(
      true,
    );
    expect(onGroup.findAll(REFUSED)).toHaveLength(1);
  });
});

import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../../utils/component';
import ConfiguratorSection from '../../../../app/components/product/configurator/ConfiguratorSection.vue';
import type { ConfigurationSection } from '#shared/types/configurator';
import {
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

  it('gives fields that sit together one grid and lets a group break the run', () => {
    const cabinet = makeCabinetConfiguration();

    const wrapper = mountSection(sectionOf(cabinet.sections, 'cabinet'));

    // Two grids: the pair between the lists, and the lone field after them.
    // The lone one keeps the box it would have had as the odd one out, rather
    // than stretching across a column a stepper does not need.
    expect(
      wrapper
        .findAll('[data-testid="configurator-variables"]')
        .map(
          (grid) =>
            grid.findAll('[data-testid="configurator-variable"]').length,
        ),
    ).toEqual([2, 1]);
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

    // Four variables, two groups, and a row per option of those two.
    expect(
      wrapper.findAll('[data-testid="configurator-variable"]'),
    ).toHaveLength(4);
    expect(wrapper.findAll('[data-testid="configurator-group"]')).toHaveLength(
      2,
    );
    expect(wrapper.findAll('[data-testid="configurator-option"]')).toHaveLength(
      5,
    );
  });

  it('passes a change from a group up untouched', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountSection(sectionOf(workbench.sections, 'frame'));
    await wrapper
      .find('[data-option-id="ind-esd"] button[role="checkbox"]')
      .trigger('click');

    expect(wrapper.emitted('change')?.[0]?.[0]).toMatchObject({
      type: 'option',
      optionId: 'ind-esd',
      selected: true,
    });
  });
});

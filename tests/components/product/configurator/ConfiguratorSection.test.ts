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

  it('puts the choices before the measurements', () => {
    const cabinet = makeCabinetConfiguration();

    const wrapper = mountSection(sectionOf(cabinet.sections, 'cabinet'));

    // The contract gives a section two lists and no order between them, so
    // this is the design reference's order, pinned so a refactor cannot
    // quietly swap it back.
    const first = wrapper.find(
      '[data-testid="configurator-group"], [data-testid="configurator-variable"]',
    );
    expect(first.attributes('data-testid')).toBe('configurator-group');
  });

  it('heads the measurements as a block of their own', () => {
    const cabinet = makeCabinetConfiguration();

    const wrapper = mountSection(sectionOf(cabinet.sections, 'cabinet'));

    // A column of lone fields under the choices reads as leftovers; the
    // measurements get the same headed, foldable block a group gets.
    const header = wrapper.find(
      '[data-testid="configurator-measurements-header"]',
    );
    expect(header.text()).toContain('configurator.measurements');
    expect(header.attributes('aria-expanded')).toBe('true');
  });

  it('summarises the measurements it holds once folded', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountSection(sectionOf(workbench.sections, 'frame'));
    await wrapper
      .find('[data-testid="configurator-measurements-header"]')
      .trigger('click');

    expect(
      wrapper.find('[data-testid="configurator-measurements-summary"]').text(),
    ).toBe('(1200 mm · 700 mm · 0 pcs · 0 %)');
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

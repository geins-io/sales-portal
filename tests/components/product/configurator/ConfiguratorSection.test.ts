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

  it('renders a visible section with its name and its variables', () => {
    const cabinet = makeCabinetConfiguration();

    const wrapper = mountSection(sectionOf(cabinet.sections, 'cabinet'));

    expect(wrapper.find('h3').text()).toBe('Cabinet');
    expect(
      wrapper.findAll('[data-testid="configurator-variable"]'),
    ).toHaveLength(3);
  });

  it('heads the section with the same bar its groups carry', () => {
    const cabinet = makeCabinetConfiguration();

    const wrapper = mountSection(sectionOf(cabinet.sections, 'cabinet'));

    const header = wrapper.find('[data-testid="configurator-section-header"]');
    expect(header.text()).toBe('Cabinet');
    expect(header.classes()).toContain('bg-muted');
  });

  it('renders a nested section inside its parent, one heading level down', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountSection(sectionOf(workbench.sections, 'frame'));

    const sections = wrapper.findAll('[data-testid="configurator-section"]');
    expect(sections.map((s) => s.attributes('data-section-id'))).toEqual([
      'frame',
      'finish',
    ]);
    expect(wrapper.find('h3').text()).toBe('Frame');
    expect(sections[1]?.find('h4').text()).toBe('Finish');
    // The nested section's own groups sit a level below it, so a group never
    // outranks the section it belongs to.
    expect(sections[1]?.find('[data-group-id="top"] h5').text()).toContain(
      'Table top',
    );
  });

  it('renders the option groups of both levels', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountSection(sectionOf(workbench.sections, 'frame'));

    const groups = wrapper.findAll('[data-testid="configurator-group"]');
    expect(groups.map((g) => g.attributes('data-group-id'))).toEqual([
      'legs',
      'industrial',
      'top',
      'color',
      'accessories',
    ]);
  });

  it('renders the whole seeded workbench document as one form', () => {
    const workbench = makeInitialConfiguration();
    expect(workbench.sections).toHaveLength(1);

    const wrapper = mountSection(sectionOf(workbench.sections, 'frame'));

    // Every node the document carries, and nothing invented: four variables,
    // five groups, and a row per option including the 26 colours.
    expect(
      wrapper.findAll('[data-testid="configurator-variable"]'),
    ).toHaveLength(4);
    expect(wrapper.findAll('[data-testid="configurator-group"]')).toHaveLength(
      5,
    );
    expect(wrapper.findAll('[data-testid="configurator-option"]')).toHaveLength(
      38,
    );
  });

  it('passes a change from a nested section up untouched', async () => {
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

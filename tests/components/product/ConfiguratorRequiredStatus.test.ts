import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ref } from 'vue';
import { mountComponent } from '../../utils/component';
import ConfiguratorRequiredStatus from '../../../app/components/product/configurator/ConfiguratorRequiredStatus.vue';
import {
  findOptionGroup,
  makeInitialConfiguration,
  makeInvalidConfiguration,
  makeValidConfiguration,
} from '../../fixtures/configurator';
import { shownConfiguration } from '../../../app/utils/configurator-shown';

// The tier's passthrough `t` drops parameters the key has no placeholder for,
// so the count would never reach the text; this one appends them.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${Object.values(params).join(' ')}` : key,
    locale: ref('en'),
  }),
}));

function mountStatus(configuration = makeValidConfiguration()) {
  return mountComponent(ConfiguratorRequiredStatus, {
    props: { configuration },
  });
}

function box(wrapper: ReturnType<typeof mountStatus>) {
  return wrapper.find('[data-testid="configurator-required-status"]');
}

function toggle(wrapper: ReturnType<typeof mountStatus>) {
  return wrapper.find('[data-testid="configurator-required-toggle"]');
}

async function mountOpen(configuration = makeInvalidConfiguration()) {
  const wrapper = mountStatus(configuration);
  await toggle(wrapper).trigger('click');
  return wrapper;
}

describe('ConfiguratorRequiredStatus', () => {
  it('says every required choice is made when the configuration is complete', () => {
    const wrapper = mountStatus();
    const status = box(wrapper);
    expect(status.text()).toBe('configurator.required_status.all_done');
    expect(
      status.find('[data-testid="configurator-required-missing"]').exists(),
    ).toBe(false);
    expect(toggle(wrapper).exists()).toBe(false);
  });

  it('starts collapsed, with the count after the heading', () => {
    const wrapper = mountStatus(makeInvalidConfiguration());

    expect(toggle(wrapper).element.tagName).toBe('BUTTON');
    expect(toggle(wrapper).attributes('type')).toBe('button');
    expect(toggle(wrapper).attributes('aria-expanded')).toBe('false');
    expect(toggle(wrapper).text()).toBe(
      'configurator.required_status.remaining_count 2',
    );
    expect(
      wrapper.find('[data-testid="configurator-required-list"]').exists(),
    ).toBe(false);
  });

  it('opens on the toggle and closes on it again', async () => {
    const wrapper = await mountOpen();

    expect(toggle(wrapper).attributes('aria-expanded')).toBe('true');
    const list = wrapper.find('[data-testid="configurator-required-list"]');
    expect(list.exists()).toBe(true);
    expect(toggle(wrapper).attributes('aria-controls')).toBe(
      list.attributes('id'),
    );

    await toggle(wrapper).trigger('click');

    expect(toggle(wrapper).attributes('aria-expanded')).toBe('false');
    expect(
      wrapper.find('[data-testid="configurator-required-list"]').exists(),
    ).toBe(false);
  });

  it('stays open when a change batch replaces the document', async () => {
    const wrapper = await mountOpen();

    await wrapper.setProps({
      configuration: makeInvalidConfiguration({
        messages: [{ severity: 'error', text: 'The template is out of date.' }],
      }),
    });

    expect(toggle(wrapper).attributes('aria-expanded')).toBe('true');
    expect(
      wrapper.find('[data-testid="configurator-required-list"]').exists(),
    ).toBe(true);
  });

  it('scrolls a long open list inside itself, capped below lg', async () => {
    const list = (await mountOpen()).find(
      '[data-testid="configurator-required-list"]',
    );
    expect(list.classes()).toEqual(
      expect.arrayContaining([
        'overflow-y-auto',
        'max-h-[40vh]',
        'lg:max-h-none',
        'min-h-0',
      ]),
    );
  });

  it('lists what is missing one per line', async () => {
    const status = box(await mountOpen());

    expect(
      status
        .findAll('[data-testid="configurator-required-missing-item"]')
        .map((item) => item.text()),
    ).toEqual(['Table top', 'Colour']);
    expect(
      status.find('[data-testid="configurator-required-missing"]').classes(),
    ).toContain('list-disc');
  });

  it('leaves the provider sentences to their groups in the form', async () => {
    const status = box(await mountOpen());
    expect(status.text()).not.toContain('Select a table top.');
    expect(
      status.find('[data-testid="configurator-required-messages"]').exists(),
    ).toBe(false);
  });

  it('makes every missing item a button to where it is', async () => {
    const items = (await mountOpen()).findAll(
      '[data-testid="configurator-required-missing-item"]',
    );

    expect(items.map((item) => item.element.tagName)).toEqual([
      'BUTTON',
      'BUTTON',
    ]);
    expect(items.map((item) => item.attributes('type'))).toEqual([
      'button',
      'button',
    ]);
  });

  it('emits the section and the node of the item clicked', async () => {
    const wrapper = await mountOpen();

    await wrapper
      .findAll('[data-testid="configurator-required-missing-item"]')[1]!
      .trigger('click');

    expect(wrapper.emitted('go-to')).toEqual([
      [{ name: 'Colour', sectionId: 'finish', kind: 'group', nodeId: 'color' }],
    ]);
  });

  it('sets the box one size smaller than body text', () => {
    const status = box(mountStatus(makeInvalidConfiguration()));
    expect(status.classes()).toContain('text-xs');
    expect(status.classes()).not.toContain('text-sm');
  });

  it('shows a blocking message no name stands for, and counts it', async () => {
    const configuration = makeInvalidConfiguration({
      messages: [{ severity: 'error', text: 'The template is out of date.' }],
    });
    const wrapper = await mountOpen(configuration);

    expect(toggle(wrapper).text()).toBe(
      'configurator.required_status.remaining_count 3',
    );
    expect(
      box(wrapper)
        .findAll('[data-testid="configurator-required-messages"] li')
        .map((item) => item.text()),
    ).toEqual(['The template is out of date.']);
  });

  it('says the configuration is incomplete when the document gives no reason', () => {
    const wrapper = mountStatus(makeValidConfiguration({ isValid: false }));
    expect(box(wrapper).text()).toBe(
      'configurator.required_status.unspecified',
    );
    expect(toggle(wrapper).exists()).toBe(false);
  });

  it('says the configuration cannot be completed when only a hidden section is missing something', () => {
    const configuration = makeInitialConfiguration();
    configuration.sections[0]!.sections[0]!.visible = false;
    const wrapper = mountStatus(configuration);

    expect(box(wrapper).text()).toBe(
      'configurator.required_status.cannot_complete',
    );
    expect(toggle(wrapper).exists()).toBe(false);
  });

  describe('when the store hides what cannot be chosen', () => {
    /** The initial document, its only unmet group (Colour) left with no row to choose. */
    function colourClosedByChoices() {
      const sent = makeInitialConfiguration();
      for (const row of findOptionGroup(sent, 'color').options) {
        row.available = false;
      }
      return sent;
    }

    function mountHiding(sent: ReturnType<typeof colourClosedByChoices>) {
      return mountComponent(ConfiguratorRequiredStatus, {
        props: { configuration: shownConfiguration(sent, true), sent },
      });
    }

    it('says the buyer’s choices block the configuration when only a hidden group is missing', () => {
      const wrapper = mountHiding(colourClosedByChoices());

      expect(box(wrapper).text()).toBe(
        'configurator.required_status.blocked_by_choices',
      );
      expect(toggle(wrapper).exists()).toBe(false);
    });

    it('says the configuration cannot be completed when a section the provider hid is missing something too', () => {
      const sent = colourClosedByChoices();
      // A second, untouched Colour in a section the provider hid.
      const unreachable = findOptionGroup(makeInitialConfiguration(), 'color');
      sent.sections.push({
        id: 'provider-hidden',
        name: 'Provider hidden',
        description: '',
        visible: false,
        sections: [],
        variables: [],
        optionGroups: [{ ...unreachable, id: 'unreachable' }],
        messages: [],
      });

      expect(box(mountHiding(sent)).text()).toBe(
        'configurator.required_status.cannot_complete',
      );
    });

    it('reads the document it is shown when no sent document is given', () => {
      const shown = shownConfiguration(colourClosedByChoices(), true);
      expect(box(mountStatus(shown)).text()).toBe(
        'configurator.required_status.unspecified',
      );
    });
  });

  it('keeps the count on the line of the word before it, in every locale', () => {
    // In the 254 px rail the heading wraps; a plain space could leave "(20)"
    // alone on a line of its own.
    const dir = resolve(__dirname, '../../../app/locales');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const locale = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
      expect(locale.configurator.required_status.remaining_count, file).toMatch(
        /\S\u00a0\(\{count\}\)$/,
      );
    }
  });
});

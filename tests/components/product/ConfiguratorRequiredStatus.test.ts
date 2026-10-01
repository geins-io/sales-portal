import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import ConfiguratorRequiredStatus from '../../../app/components/product/configurator/ConfiguratorRequiredStatus.vue';
import {
  makeInvalidConfiguration,
  makeValidConfiguration,
} from '../../fixtures/configurator';

function mountStatus(configuration = makeValidConfiguration()) {
  return mountComponent(ConfiguratorRequiredStatus, {
    props: { configuration },
  });
}

function box(wrapper: ReturnType<typeof mountStatus>) {
  return wrapper.find('[data-testid="configurator-required-status"]');
}

describe('ConfiguratorRequiredStatus', () => {
  it('says every required choice is made when the configuration is complete', () => {
    const status = box(mountStatus());
    expect(status.text()).toBe('configurator.required_status.all_done');
    expect(
      status.find('[data-testid="configurator-required-missing"]').exists(),
    ).toBe(false);
  });

  it('lists what is missing one per line, under a heading', () => {
    const status = box(mountStatus(makeInvalidConfiguration()));

    // The heading is the key alone: no names folded into a sentence.
    expect(status.find('p').text()).toBe(
      'configurator.required_status.remaining',
    );
    expect(
      status
        .findAll('[data-testid="configurator-required-missing-item"]')
        .map((item) => item.text()),
    ).toEqual(['Table top', 'Colour']);
    expect(
      status.find('[data-testid="configurator-required-missing"]').classes(),
    ).toContain('list-disc');
  });

  it('leaves the provider sentences to their groups in the form', () => {
    const status = box(mountStatus(makeInvalidConfiguration()));
    expect(status.text()).not.toContain('Select a table top.');
    expect(
      status.find('[data-testid="configurator-required-messages"]').exists(),
    ).toBe(false);
  });

  it('makes every missing item a button to where it is', () => {
    const items = mountStatus(makeInvalidConfiguration()).findAll(
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
    const wrapper = mountStatus(makeInvalidConfiguration());

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

  it('shows a blocking message no name stands for', () => {
    const status = box(
      mountStatus(
        makeInvalidConfiguration({
          messages: [
            { severity: 'error', text: 'The template is out of date.' },
          ],
        }),
      ),
    );
    expect(
      status
        .findAll('[data-testid="configurator-required-messages"] li')
        .map((item) => item.text()),
    ).toEqual(['The template is out of date.']);
  });

  it('says the configuration is incomplete when the document gives no reason', () => {
    const status = box(mountStatus(makeValidConfiguration({ isValid: false })));
    expect(status.text()).toBe('configurator.required_status.unspecified');
  });
});

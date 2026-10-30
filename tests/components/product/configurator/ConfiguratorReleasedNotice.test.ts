import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ref } from 'vue';
import { mountComponent } from '../../../utils/component';
import ConfiguratorReleasedNotice from '../../../../app/components/product/configurator/ConfiguratorReleasedNotice.vue';
import type { ReleasedChoice } from '../../../../shared/types/configurator';

// The tier's passthrough `t` drops parameters the key has no placeholder for,
// so the name would never reach the text; this one appends them.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${Object.values(params).join(' ')}` : key,
    locale: ref('en'),
  }),
}));

const KIT: ReleasedChoice = {
  optionId: 'im-kit',
  instanceId: '0',
  name: 'Aquadopp Inductive Modem Kit, DW',
};
const CABLE: ReleasedChoice = {
  optionId: 'no-cable',
  instanceId: '0',
  name: 'No cable',
};

function mountNotice(released?: ReleasedChoice[]) {
  return mountComponent(ConfiguratorReleasedNotice, { props: { released } });
}

const notice = (wrapper: ReturnType<typeof mountNotice>) =>
  wrapper.find('[data-testid="configurator-released-notice"]');

describe('ConfiguratorReleasedNotice', () => {
  it('names the choice that was taken away', () => {
    const wrapper = mountNotice([KIT]);

    expect(notice(wrapper).exists()).toBe(true);
    expect(notice(wrapper).attributes('role')).toBe('status');
    expect(
      wrapper
        .findAll('[data-testid="configurator-released-choice"]')
        .map((line) => line.text()),
    ).toEqual([
      'configurator.released_choice Aquadopp Inductive Modem Kit, DW',
    ]);
  });

  it('gives each choice its own line', () => {
    const wrapper = mountNotice([KIT, CABLE]);

    expect(
      wrapper
        .findAll('[data-testid="configurator-released-choice"]')
        .map((line) => line.text()),
    ).toEqual([
      'configurator.released_choice Aquadopp Inductive Modem Kit, DW',
      'configurator.released_choice No cable',
    ]);
  });

  it.each<[string, ReleasedChoice[] | undefined]>([
    ['absent', undefined],
    ['empty', []],
  ])('renders nothing when the list is %s', (_label, released) => {
    expect(notice(mountNotice(released)).exists()).toBe(false);
  });

  it('has the sentence in every locale, with the name in it', () => {
    const dir = resolve(__dirname, '../../../../app/locales');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const locale = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
      expect(locale.configurator.released_choice, file).toContain('{name}');
    }
  });
});

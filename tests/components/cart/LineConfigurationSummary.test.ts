import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import LineConfigurationSummary from '../../../app/components/cart/LineConfigurationSummary.vue';

const SUMMARY = [
  { label: 'Machine weight (7-20)', value: '12 t' },
  { label: 'Adapter', value: 'S45' },
  { label: 'Finish', value: '' },
];

function mountSummary(summary = SUMMARY) {
  return mountComponent(LineConfigurationSummary, {
    props: { summary, id: 'line-configuration-1' },
  });
}

const toggleOf = (wrapper: ReturnType<typeof mountSummary>) =>
  wrapper.find('[data-testid="cart-item-configuration-toggle"]');
const blockOf = (wrapper: ReturnType<typeof mountSummary>) =>
  wrapper.find('[data-testid="cart-item-configuration"]');
const defaultOf = (wrapper: ReturnType<typeof mountSummary>) =>
  wrapper.find('[data-testid="cart-item-configuration-default"]');
// `v-show`: the block is in the DOM either way, hidden by its style.
const shown = (wrapper: ReturnType<typeof mountSummary>) =>
  !blockOf(wrapper).attributes('style')?.includes('display: none');

describe('LineConfigurationSummary', () => {
  it('starts collapsed, with the toggle pointing at the block', () => {
    const wrapper = mountSummary();

    expect(toggleOf(wrapper).text()).toBe('cart.show_configuration');
    expect(toggleOf(wrapper).attributes('aria-expanded')).toBe('false');
    expect(toggleOf(wrapper).attributes('aria-controls')).toBe(
      'line-configuration-1',
    );
    expect(blockOf(wrapper).attributes('id')).toBe('line-configuration-1');
    expect(shown(wrapper)).toBe(false);
  });

  it('opens and closes from the toggle', async () => {
    const wrapper = mountSummary();

    await toggleOf(wrapper).trigger('click');

    expect(toggleOf(wrapper).text()).toBe('cart.hide_configuration');
    expect(toggleOf(wrapper).attributes('aria-expanded')).toBe('true');
    expect(shown(wrapper)).toBe(true);

    await toggleOf(wrapper).trigger('click');

    expect(toggleOf(wrapper).attributes('aria-expanded')).toBe('false');
    expect(shown(wrapper)).toBe(false);
  });

  it('lists every row as label and value, in the order given, an empty value too', () => {
    const wrapper = mountSummary();

    expect(
      blockOf(wrapper)
        .findAll('[data-testid="cart-item-configuration-row"]')
        .map((row) => [row.find('dt').text(), row.find('dd').text()]),
    ).toEqual([
      ['Machine weight (7-20)', '12 t'],
      ['Adapter', 'S45'],
      ['Finish', ''],
    ]);
  });

  it('lists no default text when there are rows', async () => {
    const wrapper = mountSummary();

    await toggleOf(wrapper).trigger('click');

    expect(defaultOf(wrapper).exists()).toBe(false);
  });

  describe('a summary with no rows: committed with the defaults only', () => {
    it('still offers the toggle, collapsed and pointing at the block', () => {
      const wrapper = mountSummary([]);

      expect(toggleOf(wrapper).text()).toBe('cart.show_configuration');
      expect(toggleOf(wrapper).attributes('aria-expanded')).toBe('false');
      expect(toggleOf(wrapper).attributes('aria-controls')).toBe(
        'line-configuration-1',
      );
      expect(blockOf(wrapper).attributes('id')).toBe('line-configuration-1');
      expect(shown(wrapper)).toBe(false);
    });

    it('says, opened, that the defaults were kept, and lists no rows', async () => {
      const wrapper = mountSummary([]);

      await toggleOf(wrapper).trigger('click');

      expect(shown(wrapper)).toBe(true);
      expect(defaultOf(wrapper).text()).toBe('cart.default_configuration');
      expect(
        blockOf(wrapper).findAll('[data-testid="cart-item-configuration-row"]'),
      ).toHaveLength(0);
    });
  });
});

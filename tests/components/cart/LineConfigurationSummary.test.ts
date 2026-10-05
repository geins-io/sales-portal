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

  it('renders nothing for an empty summary', () => {
    const wrapper = mountSummary([]);

    expect(toggleOf(wrapper).exists()).toBe(false);
    expect(blockOf(wrapper).exists()).toBe(false);
  });

  it('puts what its owner slots in at the foot of the rows, and nothing without it', () => {
    const slotted = mountComponent(LineConfigurationSummary, {
      props: { summary: SUMMARY, id: 'line-configuration-1' },
      slots: { default: '<a data-testid="slot-probe" />' },
    });
    // In a <div> of its own: a <dl> holds only groups of <dt> and <dd>.
    const foot = blockOf(slotted).element.lastElementChild;
    expect(foot?.tagName).toBe('DIV');
    expect(foot?.getAttribute('data-testid')).toBe(
      'cart-item-configuration-foot',
    );
    expect(foot?.firstElementChild).toBe(
      slotted.find('[data-testid="slot-probe"]').element,
    );

    const plain = mountSummary();
    expect(
      plain.find('[data-testid="cart-item-configuration-foot"]').exists(),
    ).toBe(false);
    expect(
      blockOf(plain).element.lastElementChild?.getAttribute('data-testid'),
    ).toBe('cart-item-configuration-row');
  });
});

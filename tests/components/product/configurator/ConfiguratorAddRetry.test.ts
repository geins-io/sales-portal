import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { mountComponent } from '../../../utils/component';
import ConfiguratorAddRetry from '../../../../app/components/product/configurator/ConfiguratorAddRetry.vue';

// What the committed summary offers when the configuration was committed but
// did not reach the cart: why, and a second try with the same record.

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: ref('en'),
  }),
}));

function mountRetry(props: Record<string, unknown> = {}) {
  return mountComponent(ConfiguratorAddRetry, {
    props: {
      message: 'configurator.add_failed',
      canRetry: true,
      busy: false,
      ...props,
    },
  });
}

describe('ConfiguratorAddRetry', () => {
  it('says why the add failed', () => {
    expect(
      mountRetry().find('[data-testid="configurator-add-error"]').text(),
    ).toBe('configurator.add_failed');
  });

  it('shows no message while the retry is under way', () => {
    expect(
      mountRetry({ message: null, busy: true, canRetry: false })
        .find('[data-testid="configurator-add-error"]')
        .exists(),
    ).toBe(false);
  });

  it('asks for the retry', async () => {
    const wrapper = mountRetry();
    const button = wrapper.find('[data-testid="configurator-add-retry"]');

    expect(button.text()).toBe('configurator.add_retry');
    await button.trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });

  it('refuses a retry the page has not allowed, spinning while one runs', async () => {
    const wrapper = mountRetry({ canRetry: false, busy: true });
    const button = wrapper.find('[data-testid="configurator-add-retry"]');

    expect(button.attributes('disabled')).toBeDefined();
    expect(button.find('.animate-spin').exists()).toBe(true);
    await button.trigger('click');
    expect(wrapper.emitted('retry')).toBeUndefined();
  });

  it('shows no spinner at rest', () => {
    expect(
      mountRetry()
        .find('[data-testid="configurator-add-retry"] .animate-spin')
        .exists(),
    ).toBe(false);
  });
});

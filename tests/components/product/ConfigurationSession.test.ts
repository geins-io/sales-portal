import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { mountComponent } from '../../utils/component';
import ConfigurationSession from '../../../app/components/product/configurator/ConfigurationSession.vue';

// The tier's passthrough `t` substitutes a parameter only where the key itself
// happens to contain its placeholder, so the countdown's value never reaches
// the rendered text and nothing here could prove it is passed through. This
// one appends the parameters instead.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${Object.values(params).join(' ')}` : key,
    locale: ref('en'),
  }),
}));

function mountSession(props: Record<string, unknown> = {}) {
  return mountComponent(ConfigurationSession, {
    props: { remainingMs: 754_000, busy: false, ...props },
  });
}

describe('ConfigurationSession', () => {
  it('renders the remaining time as a clock', () => {
    expect(mountSession({ remainingMs: 754_000 }).text()).toContain('12:34');
  });

  it('emits renew when the button is pressed', async () => {
    const wrapper = mountSession();
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('renew')).toHaveLength(1);
  });

  it('disables renew while a batch is in flight', () => {
    const wrapper = mountSession({ busy: true });
    expect(wrapper.find('button').attributes('disabled')).toBeDefined();
  });

  it('reports a renew that failed for a reason other than expiry', () => {
    const wrapper = mountSession({
      error: { status: 500, message: 'the request failed' },
    });
    expect(wrapper.text()).toContain('configurator.panel.renew_failed');
  });

  it('reports nothing when renew succeeded', () => {
    expect(mountSession().text()).not.toContain(
      'configurator.panel.renew_failed',
    );
  });
});

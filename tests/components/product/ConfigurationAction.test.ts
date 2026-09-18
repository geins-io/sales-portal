import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import { ref } from 'vue';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { mountComponent } from '../../utils/component';
import ConfigurationAction from '../../../app/components/product/configurator/ConfigurationAction.vue';
import { useTenant } from '../../../app/composables/useTenant';
import { useAuthStore } from '../../../app/stores/auth';

// Escapes the tier-wide mock, which answers true for every key; see
// tests/setup-components.ts. Without it `canUnlockByAuth` is always false and
// the sign-in state cannot be reached at all.
vi.unmock('../../../app/composables/useFeatureAccess');

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: ref('en'),
  }),
}));

const { tenant } = useTenant();

function setFeatures(features: PublicTenantConfig['features']) {
  assert.isDefined(tenant.value);
  tenant.value.features = features;
}

function mountAction(props: Record<string, unknown> = {}) {
  return mountComponent(ConfigurationAction, {
    props: { canCommit: true, busy: false, ...props },
  });
}

describe('ConfigurationAction', () => {
  beforeEach(() => {
    setFeatures({});
    // The Pinia store is shared across this file's tests.
    const auth = useAuthStore();
    auth.user = null;
    auth.closeSheet();
  });

  it('offers to finish the configuration', async () => {
    const wrapper = mountAction();
    const button = wrapper.find('[data-testid="configurator-commit"]');
    expect(button.text()).toContain('configurator.commit');
    expect(button.attributes('disabled')).toBeUndefined();

    await button.trigger('click');
    expect(wrapper.emitted('commit')).toHaveLength(1);
  });

  it('refuses a commit the page has not allowed', async () => {
    const wrapper = mountAction({ canCommit: false });
    const button = wrapper.find('[data-testid="configurator-commit"]');
    expect(button.attributes('disabled')).toBeDefined();

    await button.trigger('click');
    expect(wrapper.emitted('commit')).toBeUndefined();
  });

  it('prompts to sign in when priceVisibility requires authentication and the user is anonymous', () => {
    setFeatures({
      priceVisibility: { enabled: true, access: 'authenticated' },
    });
    const wrapper = mountAction();
    expect(
      wrapper.find('[data-testid="configurator-signin"]').text(),
    ).toContain('product.login_for_prices');
    expect(wrapper.find('[data-testid="configurator-commit"]').exists()).toBe(
      false,
    );
  });

  it('opens the portal sign-in from the prompt', async () => {
    setFeatures({
      priceVisibility: { enabled: true, access: 'authenticated' },
    });
    const wrapper = mountAction();
    await wrapper.find('[data-testid="configurator-signin"]').trigger('click');

    expect(useAuthStore().sheetOpen).toBe(true);
  });

  it('offers no sign-in when priceVisibility is disabled outright', () => {
    // Nothing the buyer can do reveals a price, so the offer would be a lie;
    // configuring and committing are still theirs to do.
    setFeatures({ priceVisibility: { enabled: false } });
    const wrapper = mountAction();
    expect(wrapper.find('[data-testid="configurator-signin"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="configurator-commit"]').exists()).toBe(
      true,
    );
  });
});

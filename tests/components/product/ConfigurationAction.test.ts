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
    props: { canCommit: true, busy: false, incomplete: false, ...props },
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

  it('offers to put the configuration in the cart', async () => {
    const wrapper = mountAction();
    const button = wrapper.find('[data-testid="configurator-commit"]');
    expect(button.text()).toBe('product.add_to_cart');
    expect(button.attributes('disabled')).toBeUndefined();

    await button.trigger('click');
    expect(wrapper.emitted('submit')).toHaveLength(1);
  });

  it('says it is busy while a request is under way, which is what a recompute shows', () => {
    expect(
      mountAction()
        .find('[data-testid="configurator-commit"]')
        .attributes('aria-busy'),
    ).toBe('false');
    expect(
      mountAction({ canCommit: false, busy: true })
        .find('[data-testid="configurator-commit"]')
        .attributes('aria-busy'),
    ).toBe('true');
  });

  it('shows the cart icon at rest and the spinner in its place while busy', () => {
    const rest = mountAction().find('[data-testid="configurator-commit"]');
    expect(rest.find('[data-testid="configurator-cart-icon"]').exists()).toBe(
      true,
    );

    const busy = mountAction({ canCommit: false, busy: true }).find(
      '[data-testid="configurator-commit"]',
    );
    expect(busy.find('[data-testid="configurator-cart-icon"]').exists()).toBe(
      false,
    );
    expect(busy.find('.animate-spin').exists()).toBe(true);
  });

  it('says why the action cannot be taken when the page gives a reason', () => {
    const wrapper = mountAction({
      canCommit: false,
      error: 'configurator.failed',
    });

    expect(
      wrapper.find('[data-testid="configurator-action-error"]').text(),
    ).toBe('configurator.failed');
  });

  it('shows no reason when the page gives none', () => {
    expect(
      mountAction().find('[data-testid="configurator-action-error"]').exists(),
    ).toBe(false);
  });

  it('refuses a commit the page has not allowed', async () => {
    const wrapper = mountAction({ canCommit: false });
    const button = wrapper.find('[data-testid="configurator-commit"]');
    expect(button.attributes('disabled')).toBeDefined();

    await button.trigger('click');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('says required choices remain while the configuration is incomplete', () => {
    const wrapper = mountAction({ canCommit: false, incomplete: true });
    const button = wrapper.find('[data-testid="configurator-commit"]');

    expect(button.text()).toBe('configurator.commit_incomplete');
    expect(button.attributes('disabled')).toBeDefined();
  });

  it('keeps the cart label and the spinner while a request is in flight', () => {
    const wrapper = mountAction({ canCommit: false, busy: true });
    const button = wrapper.find('[data-testid="configurator-commit"]');

    expect(button.text()).toBe('product.add_to_cart');
    expect(button.attributes('disabled')).toBeDefined();
    expect(button.find('.animate-spin').exists()).toBe(true);
  });

  it('spins beside the incomplete label when a change is in flight', () => {
    // The document in hand is still incomplete until the batch answers.
    const wrapper = mountAction({
      canCommit: false,
      busy: true,
      incomplete: true,
    });
    const button = wrapper.find('[data-testid="configurator-commit"]');

    expect(button.text()).toBe('configurator.commit_incomplete');
    expect(button.find('.animate-spin').exists()).toBe(true);
  });

  it('shows no spinner at rest', () => {
    expect(
      mountAction()
        .find('[data-testid="configurator-commit"] .animate-spin')
        .exists(),
    ).toBe(false);
  });

  it('prompts to sign in when priceVisibility requires authentication and the user is anonymous', () => {
    setFeatures({
      priceVisibility: { enabled: true, access: 'authenticated' },
    });
    const wrapper = mountAction({ canCommit: false, incomplete: true });
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

  describe('editing a cart line', () => {
    const editMount = (props: Record<string, unknown> = {}) =>
      mountAction({ editing: true, ...props });

    it('updates the line instead of adding one, as the design reference does', async () => {
      const wrapper = editMount();
      const update = wrapper.find('[data-testid="configurator-commit"]');

      expect(update.text()).toBe('configurator.edit.update');
      expect(update.text()).not.toContain('product.add_to_cart');
      await update.trigger('click');
      expect(wrapper.emitted('submit')).toHaveLength(1);
    });

    it('says required choices remain, and stays shut, while the provider says so', () => {
      const update = editMount({ canCommit: false, incomplete: true }).find(
        '[data-testid="configurator-commit"]',
      );

      expect(update.text()).toBe('configurator.commit_incomplete');
      expect(update.attributes('disabled')).toBeDefined();
    });

    it('offers to revert and to cancel, under the update', async () => {
      const wrapper = editMount();
      const revert = wrapper.find('[data-testid="configurator-edit-revert"]');
      const cancel = wrapper.find('[data-testid="configurator-edit-cancel"]');

      expect(revert.text()).toBe('configurator.edit.revert');
      expect(cancel.text()).toBe('configurator.edit.cancel');
      await revert.trigger('click');
      await cancel.trigger('click');
      expect(wrapper.emitted('revert')).toHaveLength(1);
      expect(wrapper.emitted('cancel')).toHaveLength(1);
      expect(wrapper.emitted('submit')).toBeUndefined();
    });

    it('lets nothing else be pressed while a request is under way', () => {
      const wrapper = editMount({ canCommit: false, busy: true });

      for (const id of [
        'configurator-edit-revert',
        'configurator-edit-cancel',
      ]) {
        expect(
          wrapper.find(`[data-testid="${id}"]`).attributes('disabled'),
        ).toBeDefined();
      }
    });

    it('offers neither outside edit mode', () => {
      const wrapper = mountAction();

      expect(
        wrapper.find('[data-testid="configurator-edit-revert"]').exists(),
      ).toBe(false);
      expect(
        wrapper.find('[data-testid="configurator-edit-cancel"]').exists(),
      ).toBe(false);
    });
  });
});

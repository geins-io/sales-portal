import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import { ref } from 'vue';
import type { AuthUser } from '@geins/types';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { mountComponent } from '../../utils/component';
import ConfigurationHeader from '../../../app/components/product/configurator/ConfigurationHeader.vue';
import { useTenant } from '../../../app/composables/useTenant';
import { useAuthStore } from '../../../app/stores/auth';
import {
  makeInvalidConfiguration,
  makeValidConfiguration,
} from '../../fixtures/configurator';

// Escapes the tier-wide mock, which answers true for every key; see
// tests/setup-components.ts. Without it `canUnlockByAuth` is always false and
// the sign-in state cannot be reached at all.
vi.unmock('../../../app/composables/useFeatureAccess');

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

const { tenant } = useTenant();

function setFeatures(features: PublicTenantConfig['features']) {
  assert.isDefined(tenant.value);
  tenant.value.features = features;
}

// `isAuthenticated` is `!!user.value`, so identity is all this needs to carry.
const SIGNED_IN: AuthUser = { userId: '1', username: 'buyer@example.com' };

// Intl separates the amount from the currency with a non-breaking space, so
// every comparison against a written-out price goes through this.
function plainText(text: string): string {
  return text.replace(/\u00a0/g, ' ');
}

function mountHeader(props: Record<string, unknown> = {}) {
  return mountComponent(ConfigurationHeader, {
    props: {
      configuration: makeValidConfiguration(),
      status: 'active',
      busy: false,
      remainingMs: 754_000,
      ...props,
    },
  });
}

describe('ConfigurationHeader', () => {
  beforeEach(() => {
    setFeatures({});
    // The Pinia store is shared across this file's tests.
    useAuthStore().user = null;
  });

  it('renders nothing before a session exists', () => {
    const wrapper = mountHeader({ configuration: null, status: 'idle' });
    expect(
      wrapper.find('[data-testid="configurator-header-price"]').exists(),
    ).toBe(false);
    expect(wrapper.text()).toBe('');
  });

  describe('price', () => {
    it('renders the unit price of the document', () => {
      const wrapper = mountHeader();
      // The tier's locale is 'en', so this is Intl's English shape for SEK.
      expect(
        plainText(
          wrapper.find('[data-testid="configurator-header-price"]').text(),
        ),
      ).toBe('SEK 3,200.00');
    });

    it('takes the currency from the document rather than a default', () => {
      const config = makeValidConfiguration();
      config.unitPrice = { net: 1000, currency: 'EUR' };
      const wrapper = mountHeader({ configuration: config });
      expect(
        plainText(
          wrapper.find('[data-testid="configurator-header-price"]').text(),
        ),
      ).toBe('€1,000.00');
    });
  });

  // One test per configured value of `priceVisibility`, each writing the value
  // and asserting what the header does with it.
  describe('priceVisibility', () => {
    it('shows the price when priceVisibility is absent from features', () => {
      const wrapper = mountHeader();
      expect(plainText(wrapper.text())).toContain('SEK 3,200.00');
    });

    it('shows the price when priceVisibility is enabled with no access rule', () => {
      setFeatures({ priceVisibility: { enabled: true } });
      const wrapper = mountHeader();
      expect(plainText(wrapper.text())).toContain('SEK 3,200.00');
    });

    it('renders neither price nor prompt when priceVisibility is disabled', () => {
      // Nothing the buyer can do reveals it, so there is nothing to offer.
      setFeatures({ priceVisibility: { enabled: false } });
      const wrapper = mountHeader();
      expect(
        wrapper.find('[data-testid="configurator-header-price"]').text(),
      ).toBe('');
      expect(wrapper.text()).not.toContain('product.login_for_prices');
    });

    it('shows the price when priceVisibility access is open to all', () => {
      setFeatures({ priceVisibility: { enabled: true, access: 'all' } });
      const wrapper = mountHeader();
      expect(plainText(wrapper.text())).toContain('SEK 3,200.00');
    });

    it('prompts to sign in when priceVisibility requires authentication and the user is anonymous', () => {
      setFeatures({
        priceVisibility: { enabled: true, access: 'authenticated' },
      });
      const wrapper = mountHeader();
      expect(wrapper.text()).toContain('product.login_for_prices');
      expect(plainText(wrapper.text())).not.toContain('SEK 3,200.00');
    });

    it('shows the price when priceVisibility requires authentication and the user is signed in', () => {
      setFeatures({
        priceVisibility: { enabled: true, access: 'authenticated' },
      });
      useAuthStore().user = SIGNED_IN;
      const wrapper = mountHeader();
      expect(plainText(wrapper.text())).toContain('SEK 3,200.00');
      expect(wrapper.text()).not.toContain('product.login_for_prices');
    });

    it('still renders validity and expiry when the price is hidden', () => {
      setFeatures({ priceVisibility: { enabled: false } });
      const wrapper = mountHeader();
      expect(wrapper.text()).toContain('configurator.header.valid');
      expect(wrapper.text()).toContain('configurator.header.renew');
    });
  });

  describe('validity', () => {
    it('confirms a complete configuration', () => {
      const wrapper = mountHeader();
      const validity = wrapper.find(
        '[data-testid="configurator-header-validity"]',
      );
      expect(validity.text()).toContain('configurator.header.valid');
      expect(validity.text()).not.toContain('configurator.header.invalid');
    });

    it('lists every blocking message of an incomplete configuration', () => {
      const wrapper = mountHeader({
        configuration: makeInvalidConfiguration(),
      });
      const validity = wrapper.find(
        '[data-testid="configurator-header-validity"]',
      );
      expect(validity.text()).toContain('configurator.header.invalid');
      const items = validity.findAll('li').map((item) => item.text());
      expect(items).toEqual(['Select a table top.', 'Select a colour.']);
    });
  });

  describe('recomputing', () => {
    it('renders no indicator while nothing is in flight', () => {
      const wrapper = mountHeader();
      expect(
        wrapper.find('[data-testid="configurator-header-busy"]').exists(),
      ).toBe(false);
    });

    it('renders the indicator while a batch is in flight', () => {
      const wrapper = mountHeader({ busy: true });
      expect(
        wrapper.find('[data-testid="configurator-header-busy"]').text(),
      ).toContain('configurator.header.recomputing');
    });

    it('disables renew while a batch is in flight', () => {
      const wrapper = mountHeader({ busy: true });
      const renew = wrapper
        .find('[data-testid="configurator-header-expiry"]')
        .find('button');
      expect(renew.attributes('disabled')).toBeDefined();
    });
  });

  describe('expiry', () => {
    it('renders the remaining time as a clock', () => {
      const wrapper = mountHeader({ remainingMs: 754_000 });
      expect(
        wrapper.find('[data-testid="configurator-header-expiry"]').text(),
      ).toContain('12:34');
    });

    it('emits renew when the button is pressed', async () => {
      const wrapper = mountHeader();
      await wrapper
        .find('[data-testid="configurator-header-expiry"]')
        .find('button')
        .trigger('click');
      expect(wrapper.emitted('renew')).toHaveLength(1);
    });

    it('reports a renew that failed for a reason other than expiry', () => {
      const wrapper = mountHeader({
        error: { status: 500, message: 'the request failed' },
      });
      expect(
        wrapper.find('[data-testid="configurator-header-expiry"]').text(),
      ).toContain('configurator.header.renew_failed');
    });

    it('reports nothing when renew succeeded', () => {
      const wrapper = mountHeader();
      expect(wrapper.text()).not.toContain('configurator.header.renew_failed');
    });
  });

  describe('expired', () => {
    it('offers a way to start over instead of an error', () => {
      const wrapper = mountHeader({ status: 'expired' });
      const expired = wrapper.find(
        '[data-testid="configurator-header-expired"]',
      );
      expect(expired.text()).toContain('configurator.header.expired');
      expect(expired.text()).toContain('configurator.header.start_over');
    });

    it('drops the price, the validity and the countdown', () => {
      const wrapper = mountHeader({ status: 'expired' });
      for (const region of ['price', 'validity', 'busy', 'expiry']) {
        expect(
          wrapper
            .find(`[data-testid="configurator-header-${region}"]`)
            .exists(),
        ).toBe(false);
      }
    });

    it('renders the expired state with no document left', () => {
      // A session that expired before its first response has none.
      const wrapper = mountHeader({ configuration: null, status: 'expired' });
      expect(wrapper.text()).toContain('configurator.header.expired');
    });

    it('emits restart when start over is pressed', async () => {
      const wrapper = mountHeader({ status: 'expired' });
      await wrapper
        .find('[data-testid="configurator-header-expired"]')
        .find('button')
        .trigger('click');
      expect(wrapper.emitted('restart')).toHaveLength(1);
    });
  });
});

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  assert,
} from 'vitest';
import { ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import type { AuthUser } from '@geins/types';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { mountComponent } from '../../utils/component';
import ConfigurationPanel from '../../../app/components/product/configurator/ConfigurationPanel.vue';
import { useTenant } from '../../../app/composables/useTenant';
import { useAuthStore } from '../../../app/stores/auth';
import {
  findOption,
  makeInvalidConfiguration,
  makeValidConfiguration,
} from '../../fixtures/configurator';

// Escapes the tier-wide mock, which answers true for every key; see
// tests/setup-components.ts. Without it `canUnlockByAuth` is always false and
// the sign-in state cannot be reached at all.
vi.unmock('../../../app/composables/useFeatureAccess');

// The tier's passthrough `t` substitutes a parameter only where the key itself
// happens to contain its placeholder, so a count never reaches the rendered
// text and nothing here could prove it is passed through. This one appends the
// parameters instead.
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

function mountPanel(props: Record<string, unknown> = {}) {
  return mountComponent(ConfigurationPanel, {
    props: {
      configuration: makeValidConfiguration(),
      status: 'active',
      busy: false,
      productName: 'Arbetsbord Pro',
      articleNumber: 'KONF-1001',
      ...props,
    },
  });
}

describe('ConfigurationPanel', () => {
  beforeEach(() => {
    setFeatures({});
    // The Pinia store is shared across this file's tests.
    useAuthStore().user = null;
  });

  it('renders nothing before a session exists', () => {
    const wrapper = mountPanel({ configuration: null, status: 'idle' });
    expect(
      wrapper.find('[data-testid="configurator-panel-price"]').exists(),
    ).toBe(false);
    expect(wrapper.text()).toBe('');
  });

  describe('header', () => {
    it('names the specification and nothing else', () => {
      useAuthStore().user = { ...SIGNED_IN, customerType: 'ORGANIZATION' };
      const header = mountPanel().find(
        '[data-testid="configurator-panel-header"]',
      );
      expect(header.text()).toBe('configurator.panel.title');
      expect(header.text()).not.toContain('KONF-1001');
    });
  });

  describe('specification', () => {
    it('groups the choices under the section they were made in', () => {
      const rows = mountPanel().find('[data-testid="configurator-panel-rows"]');
      expect(rows.findAll('h4').map((heading) => heading.text())).toEqual([
        'Frame',
        'Finish',
      ]);
    });

    it('writes each choice as its label and its value', () => {
      const rows = mountPanel().find('[data-testid="configurator-panel-rows"]');
      expect(rows.findAll('dt').map((term) => term.text())).toEqual([
        'Leg frame',
        'Width',
        'Depth',
        'Table top',
        'Colour',
      ]);
      expect(rows.text()).toContain('Fixed height legs');
      // Written the way the field writes it: grouped for the locale, with the
      // unit beside it.
      expect(rows.text()).toContain('1,200 mm');
    });

    it('writes a measurement with the decimals the provider asked for', () => {
      const config = makeValidConfiguration();
      const width = config.sections[0]!.variables.find((v) => v.id === 'width');
      assert.isDefined(width);
      width.decimals = 1;
      width.value = 12.5;

      const rows = mountPanel({ configuration: config }).find(
        '[data-testid="configurator-panel-rows"]',
      );
      expect(rows.text()).toContain('12.5 mm');
    });

    it('annotates a choice that costs something and says nothing where it costs nothing', () => {
      const config = makeValidConfiguration();
      findOption(config, 'legs-fixed').selected = false;
      findOption(config, 'legs-electric').selected = true;

      const rows = mountPanel({ configuration: config }).find(
        '[data-testid="configurator-panel-rows"]',
      );
      expect(plainText(rows.text())).toContain('+SEK 4,200.00');
      // The laminate top and black are included in the base price; a column of
      // zeroes would say only that.
      expect(plainText(rows.text())).not.toContain('SEK 0.00');
    });

    it('states how many of an option were chosen, above one', () => {
      const config = makeValidConfiguration();
      const power = findOption(config, 'acc-power');
      power.selected = true;
      power.quantity = 3;

      const rows = mountPanel({ configuration: config }).find(
        '[data-testid="configurator-panel-rows"]',
      );
      expect(rows.text()).toContain(
        'Power strip · configurator.panel.quantity_suffix 3',
      );
      expect(rows.text()).toContain('Fixed height legs');
      expect(rows.text()).not.toContain(
        'Fixed height legs · configurator.panel.quantity_suffix 1',
      );
    });

    it('hides a price the buyer may not see, keeping the choice itself', () => {
      setFeatures({ priceVisibility: { enabled: false } });
      const config = makeValidConfiguration();
      findOption(config, 'legs-fixed').selected = false;
      findOption(config, 'legs-electric').selected = true;

      const rows = mountPanel({ configuration: config }).find(
        '[data-testid="configurator-panel-rows"]',
      );
      expect(rows.text()).toContain('Electric height legs');
      expect(plainText(rows.text())).not.toContain('4,200');
    });
  });

  describe('price', () => {
    it('renders the unit price of the document', () => {
      const wrapper = mountPanel();
      // The tier's locale is 'en', so this is Intl's English shape for SEK.
      expect(
        plainText(
          wrapper.find('[data-testid="configurator-panel-price"]').text(),
        ),
      ).toContain('SEK 3,200.00');
    });

    it('takes the currency from the document rather than a default', () => {
      const config = makeValidConfiguration();
      config.unitPrice = { sellingPriceExVat: 1000, currency: { code: 'EUR' } };
      const wrapper = mountPanel({ configuration: config });
      expect(
        plainText(
          wrapper.find('[data-testid="configurator-panel-price"]').text(),
        ),
      ).toContain('€1,000.00');
    });

    it('leaves the indicative note to the copied text', () => {
      expect(
        mountPanel().find('[data-testid="configurator-panel-price"]').text(),
      ).not.toContain('configurator.panel.indicative');
    });

    it('names the quantity only when more than one is being configured', () => {
      const price = () =>
        mountPanel().find('[data-testid="configurator-panel-price"]').text();
      expect(price()).not.toContain('configurator.panel.quantity_suffix');

      const config = makeValidConfiguration();
      config.quantity = 4;
      expect(
        mountPanel({ configuration: config })
          .find('[data-testid="configurator-panel-price"]')
          .text(),
      ).toContain('configurator.panel.quantity_suffix 4');
    });

    it('shows a discounted price as it arrives, with its percentage beside it', () => {
      // `unitPrice` already has the discount taken off; taking it off again
      // would show 2,400 against the 3,200 commit freezes.
      const config = makeValidConfiguration();
      config.discountPercent = 25;

      const wrapper = mountPanel({ configuration: config });
      const price = plainText(
        wrapper.find('[data-testid="configurator-panel-price"]').text(),
      );
      expect(price).toContain('SEK 3,200.00');
      expect(price).not.toContain('SEK 2,400.00');
      expect(price).toContain('25%');
      expect(wrapper.find('.line-through').exists()).toBe(false);
    });
  });

  // One test per configured value of `priceVisibility`, each writing the value
  // and asserting what the panel does with it.
  describe('priceVisibility', () => {
    it('shows the price when priceVisibility is absent from features', () => {
      const wrapper = mountPanel();
      expect(plainText(wrapper.text())).toContain('SEK 3,200.00');
    });

    it('shows the price when priceVisibility is enabled with no access rule', () => {
      setFeatures({ priceVisibility: { enabled: true } });
      const wrapper = mountPanel();
      expect(plainText(wrapper.text())).toContain('SEK 3,200.00');
    });

    it('renders no price block when priceVisibility is disabled', () => {
      // Nothing the buyer can do reveals it; the sign-in offer is the action's,
      // and it makes none either.
      setFeatures({ priceVisibility: { enabled: false } });
      const wrapper = mountPanel();
      expect(
        wrapper.find('[data-testid="configurator-panel-price"]').exists(),
      ).toBe(false);
    });

    it('shows the price when priceVisibility access is open to all', () => {
      setFeatures({ priceVisibility: { enabled: true, access: 'all' } });
      const wrapper = mountPanel();
      expect(plainText(wrapper.text())).toContain('SEK 3,200.00');
    });

    it('hides the price when priceVisibility requires authentication and the user is anonymous', () => {
      setFeatures({
        priceVisibility: { enabled: true, access: 'authenticated' },
      });
      const wrapper = mountPanel();
      expect(plainText(wrapper.text())).not.toContain('SEK 3,200.00');
    });

    it('shows the price when priceVisibility requires authentication and the user is signed in', () => {
      setFeatures({
        priceVisibility: { enabled: true, access: 'authenticated' },
      });
      useAuthStore().user = SIGNED_IN;
      const wrapper = mountPanel();
      expect(plainText(wrapper.text())).toContain('SEK 3,200.00');
    });

    it('still renders the specification and the validity when the price is hidden', () => {
      setFeatures({ priceVisibility: { enabled: false } });
      const wrapper = mountPanel();
      expect(wrapper.text()).toContain('Fixed height legs');
      expect(wrapper.text()).toContain('configurator.panel.valid');
    });
  });

  describe('validity', () => {
    it('confirms a complete configuration', () => {
      const wrapper = mountPanel();
      const validity = wrapper.find(
        '[data-testid="configurator-panel-validity"]',
      );
      expect(validity.text()).toContain('configurator.panel.valid');
      expect(validity.text()).not.toContain('configurator.panel.invalid');
    });

    it('names what an incomplete configuration is still waiting on', () => {
      // The provider's own sentences stand beside their groups in the form;
      // repeating them here put the same text on screen twice.
      const wrapper = mountPanel({
        configuration: makeInvalidConfiguration(),
      });
      const validity = wrapper.find(
        '[data-testid="configurator-panel-validity"]',
      );
      expect(validity.text()).toContain(
        'configurator.panel.invalid Table top, Colour',
      );
      expect(validity.text()).not.toContain('Select a table top.');
      expect(validity.findAll('li')).toHaveLength(0);
    });

    it('shows a blocking message no name stands for', () => {
      const wrapper = mountPanel({
        configuration: makeInvalidConfiguration({
          messages: [
            { severity: 'error', text: 'The template is out of date.' },
          ],
        }),
      });
      const validity = wrapper.find(
        '[data-testid="configurator-panel-validity"]',
      );
      expect(validity.findAll('li').map((item) => item.text())).toEqual([
        'The template is out of date.',
      ]);
    });

    it('says the configuration is incomplete when the document gives no reason', () => {
      const config = makeValidConfiguration({ isValid: false });
      const validity = mountPanel({ configuration: config }).find(
        '[data-testid="configurator-panel-validity"]',
      );
      expect(validity.text()).toContain(
        'configurator.panel.invalid_unspecified',
      );
    });
  });

  describe('recomputing', () => {
    it('renders no indicator while nothing is in flight', () => {
      const wrapper = mountPanel();
      expect(
        wrapper.find('[data-testid="configurator-panel-busy"]').exists(),
      ).toBe(false);
    });

    it('renders the indicator while a batch is in flight', () => {
      const wrapper = mountPanel({ busy: true });
      expect(
        wrapper.find('[data-testid="configurator-panel-busy"]').text(),
      ).toContain('configurator.panel.recomputing');
    });
  });

  describe('copy', () => {
    afterEach(() => {
      Reflect.deleteProperty(navigator, 'clipboard');
      Reflect.deleteProperty(navigator, 'permissions');
    });

    it('copies the specification as plain text', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      // jsdom has neither a clipboard nor a permission to write to it, and
      // without both `useClipboard` reports the feature unsupported, renders
      // no button, and writes nothing when one is pressed.
      // Defined on the real navigator rather than stubbed as a global: VueUse
      // captures `window.navigator` when the module is loaded, so a global
      // replaced afterwards is one it never reads. Deleted again in afterEach:
      // the tier runs without isolation, so a clipboard left behind is one
      // every later file in this worker would see.
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
      Object.defineProperty(navigator, 'permissions', {
        value: {
          query: vi.fn().mockResolvedValue({
            state: 'granted',
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          }),
        },
        configurable: true,
      });

      const wrapper = mountPanel();
      await flushPromises();
      const button = wrapper.find('[data-testid="configurator-panel-copy"]');
      expect(button.exists()).toBe(true);
      await button.trigger('click');
      await flushPromises();

      // The confirmation the button flashes is the one state a reader looks
      // for, so it is the success colour rather than the button's own.
      expect(button.text()).toContain('configurator.panel.copied');
      expect(button.find('.text-success').exists()).toBe(true);

      const copied = writeText.mock.calls[0]?.[0] as string;
      expect(copied).toContain('Arbetsbord Pro (KONF-1001)');
      expect(copied).toContain('configurator.panel.indicative');
      expect(copied).toContain('FRAME');
      expect(copied).toContain('  Colour:');
      expect(copied).toContain('Black (RAL 9005)');
    });
  });

  describe('expired', () => {
    it('offers a way to start over instead of an error', () => {
      const wrapper = mountPanel({ status: 'expired' });
      const expired = wrapper.find(
        '[data-testid="configurator-panel-expired"]',
      );
      expect(expired.text()).toContain('configurator.panel.expired');
      expect(expired.text()).toContain('configurator.panel.start_over');
    });

    it('drops the specification, the price and the validity', () => {
      const wrapper = mountPanel({ status: 'expired' });
      for (const region of ['header', 'rows', 'price', 'validity', 'busy']) {
        expect(
          wrapper.find(`[data-testid="configurator-panel-${region}"]`).exists(),
        ).toBe(false);
      }
    });

    it('renders the expired state with no document left', () => {
      // A session that expired before its first response has none.
      const wrapper = mountPanel({ configuration: null, status: 'expired' });
      expect(wrapper.text()).toContain('configurator.panel.expired');
    });

    it('emits restart when start over is pressed', async () => {
      const wrapper = mountPanel({ status: 'expired' });
      await wrapper
        .find('[data-testid="configurator-panel-expired"]')
        .find('button')
        .trigger('click');
      expect(wrapper.emitted('restart')).toHaveLength(1);
    });
  });
});

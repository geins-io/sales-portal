import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { mountComponent } from '../../../utils/component';
import ConfiguratorCommitted from '../../../../app/components/product/configurator/ConfiguratorCommitted.vue';
import type { CommittedConfiguration } from '../../../../shared/types/configurator';
import { useTenant } from '../../../../app/composables/useTenant';

// The committed summary is the end of the flow: what was built, and what it
// costs. It renders no control, and nothing here leads to a cart.
//
// Escapes the tier-wide mock, which answers true for every key; see
// tests/setup-components.ts. Without it `priceVisibility` can never be refused.
vi.unmock('../../../../app/composables/useFeatureAccess');

const { tenant } = useTenant();

function setFeatures(features: PublicTenantConfig['features']) {
  assert.isDefined(tenant.value);
  tenant.value.features = features;
}

function makeCommitted(
  overrides: Partial<CommittedConfiguration> = {},
): CommittedConfiguration {
  return {
    committedConfigurationId: 'committed-1',
    configurationId: 'session-1',
    productId: '1101',
    quantity: 1,
    unitPrice: { net: 4100, currency: 'SEK' },
    summary: [
      { label: 'Steel top', value: '1', price: { net: 900, currency: 'SEK' } },
      { label: 'Width', value: '1400 mm' },
    ],
    ...overrides,
  };
}

function mountCommitted(overrides: Partial<CommittedConfiguration> = {}) {
  return mountComponent(ConfiguratorCommitted, {
    props: { committed: makeCommitted(overrides) },
  });
}

/** Intl separates the amount from the currency with a non-breaking space. */
function plainText(text: string): string {
  return text.replace(/\u00a0/g, ' ');
}

describe('ConfiguratorCommitted', () => {
  beforeEach(() => {
    setFeatures({});
  });

  it('renders one row per summary line', () => {
    const wrapper = mountCommitted();

    const rows = wrapper.findAll('[data-testid="configurator-summary"] > div');
    expect(rows.length).toBe(2);
    expect(rows[0]?.text()).toContain('Steel top');
    expect(rows[1]?.text()).toContain('1400 mm');
  });

  it('renders the price a line carries, in the currency the line carries', () => {
    const wrapper = mountCommitted({
      summary: [
        {
          label: 'Steel top',
          value: '1',
          price: { net: 900, currency: 'EUR' },
        },
      ],
    });

    // The tier's locale is 'en', so this is Intl's English shape.
    expect(plainText(wrapper.text())).toContain('€900.00');
  });

  it('leaves a line without a price without one', () => {
    const wrapper = mountCommitted({
      summary: [{ label: 'Width', value: '1400 mm' }],
    });

    // Scoped to the row: the unit price below it is always an amount.
    expect(
      wrapper.find('[data-testid="configurator-summary"]').text(),
    ).not.toContain('SEK');
  });

  it('renders the committed unit price', () => {
    const wrapper = mountCommitted();

    expect(
      plainText(
        wrapper.find('[data-testid="configurator-committed-price"]').text(),
      ),
    ).toContain('SEK 4,100.00');
  });

  it('renders a configuration with nothing chosen beyond its defaults', () => {
    const wrapper = mountCommitted({ summary: [] });

    expect(
      wrapper.find('[data-testid="configurator-committed"]').exists(),
    ).toBe(true);
    expect(
      wrapper.findAll('[data-testid="configurator-summary"] > div').length,
    ).toBe(0);
  });

  describe('priceVisibility', () => {
    it('shows every price when the tenant has no rule', () => {
      const text = plainText(mountCommitted().text());
      expect(text).toContain('SEK 4,100.00');
      expect(text).toContain('SEK 900.00');
    });

    it('shows what was built but no price when prices are hidden', () => {
      setFeatures({
        priceVisibility: { enabled: true, access: 'authenticated' },
      });
      const wrapper = mountCommitted();

      expect(wrapper.text()).toContain('Steel top');
      expect(wrapper.text()).toContain('1400 mm');
      expect(
        wrapper.find('[data-testid="configurator-committed-price"]').exists(),
      ).toBe(false);
      expect(plainText(wrapper.text())).not.toContain('SEK');
    });
  });
});

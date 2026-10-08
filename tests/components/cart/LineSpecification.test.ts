import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import { ref } from 'vue';
import type {
  LineConfigurationSummary,
  PriceType,
} from '#shared/types/commerce';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { mountComponent } from '../../utils/component';
import LineSpecification from '../../../app/components/cart/LineSpecification.vue';
import { useTenant } from '../../../app/composables/useTenant';

// Parameters appended, so a count or a rate can be read off the text.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${Object.values(params).join(' ')}` : key,
    locale: ref('en'),
  }),
}));

// The sheet's content inline, keeping the `open` gate.
vi.mock('../../../app/components/ui/sheet', () => ({
  Sheet: {
    template:
      '<div><slot v-if="open" /><button data-testid="sheet-close" @click="$emit(\'update:open\', false)" /></div>',
    props: ['open'],
    emits: ['update:open'],
  },
  SheetContent: { template: '<div><slot /></div>', props: ['side'] },
  SheetHeader: { template: '<div><slot /></div>' },
  SheetTitle: { template: '<h2 data-testid="sheet-title"><slot /></h2>' },
  SheetDescription: {
    template: '<p data-testid="sheet-description"><slot /></p>',
  },
}));

const { tenant } = useTenant();

function setFeatures(features: PublicTenantConfig['features']) {
  assert.isDefined(tenant.value);
  tenant.value.features = features;
}

const plain = (text: string) => text.replace(/\u00a0/g, ' ');

const SEK = { code: 'SEK' };
const UNIT: PriceType = {
  sellingPriceExVat: 2711.08,
  vat: 677.77,
  sellingPriceIncVat: 3388.85,
  currency: SEK,
};
const TOTAL: PriceType = {
  sellingPriceExVat: 5422.16,
  vat: 1355.54,
  sellingPriceIncVat: 6777.7,
  currency: SEK,
};

const WITH_SECTIONS: LineConfigurationSummary = {
  summary: [{ label: 'Adapter', value: 'S45' }],
  sections: [
    {
      name: 'Dimensions',
      sortIndex: 5,
      variables: [
        { id: 'width', name: 'Width', sortIndex: 1, value: 1200, unit: 'mm' },
      ],
      optionGroups: [],
      sections: [],
    },
    {
      name: 'Machine',
      sortIndex: 2,
      variables: [],
      optionGroups: [
        {
          id: 'adapter',
          name: 'Adapter',
          sortIndex: 1,
          options: [
            {
              name: 'S45',
              quantity: 1,
              unitPrice: { sellingPriceExVat: 1870.2, currency: SEK },
            },
            {
              name: 'J250 Bucket Teeth',
              quantity: 4,
              unitPrice: { sellingPriceExVat: 619.49, currency: SEK },
            },
          ],
          optionGroups: [],
        },
      ],
      sections: [],
    },
  ],
};

function mountLine(props: Record<string, unknown> = {}) {
  return mountComponent(LineSpecification, {
    props: {
      id: 'cart-item-configuration-item-1',
      productName: 'Excavator bucket',
      quantity: 2,
      configuration: WITH_SECTIONS,
      unitPrice: UNIT,
      totalPrice: TOTAL,
      ...props,
    },
  });
}

const trigger = (wrapper: ReturnType<typeof mountLine>) =>
  wrapper.find('[data-testid="line-specification-open"]');
const sheet = (wrapper: ReturnType<typeof mountLine>) =>
  wrapper.find('[data-testid="line-specification-sheet"]');

async function opened(props: Record<string, unknown> = {}) {
  const wrapper = mountLine(props);
  await trigger(wrapper).trigger('click');
  return wrapper;
}

describe('LineSpecification', () => {
  beforeEach(() => {
    setFeatures({});
  });

  it('shows a button that opens the specification, and no sheet before it is pressed', () => {
    const wrapper = mountLine();

    expect(trigger(wrapper).element.tagName).toBe('BUTTON');
    expect(trigger(wrapper).text()).toBe('cart.show_configuration');
    expect(trigger(wrapper).attributes('id')).toBe(
      'cart-item-configuration-item-1',
    );
    expect(sheet(wrapper).exists()).toBe(false);
  });

  it('opens a sheet titled with the specification and the product name', async () => {
    const wrapper = await opened();

    expect(sheet(wrapper).exists()).toBe(true);
    expect(wrapper.find('[data-testid="sheet-title"]').text()).toBe(
      'configurator.panel.title',
    );
    expect(wrapper.find('[data-testid="sheet-description"]').text()).toBe(
      'Excavator bucket',
    );
  });

  it('lists the values by section, sections in index order, each option with its price', async () => {
    const wrapper = await opened();

    const headings = sheet(wrapper).findAll('h4');
    expect(headings.map((h) => h.text())).toEqual(['Machine', 'Dimensions']);
    const values = sheet(wrapper)
      .findAll('dd')
      .map((dd) => plain(dd.text()));
    expect(values[0]).toMatch(/^S45\s*\+.*1,870\.20/);
    expect(values[1]).toMatch(
      /^J250 Bucket Teeth · configurator\.panel\.quantity_suffix 4\s*\+.*619\.49/,
    );
    expect(values[2]).toBe('1,200 mm');
  });

  it("totals the line from its own total, with the unit's VAT rate", async () => {
    const wrapper = await opened();

    const rows = sheet(wrapper)
      .findAll('[data-testid="line-specification-price-row"]')
      .map((row) => plain(row.text()).replace(/\s+/g, ' '));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(
      /^configurator\.panel\.net_price · configurator\.panel\.quantity_suffix 2\s*.*5,422\.16$/,
    );
    expect(rows[1]).toMatch(/^configurator\.panel\.vat 25\s*.*1,355\.54$/);
    expect(rows[2]).toMatch(/^configurator\.panel\.inc_vat\s*.*6,777\.70$/);
  });

  it('says there is no rate where the unit price has none to give', async () => {
    const wrapper = await opened({
      unitPrice: { sellingPriceExVat: 0, vat: 0, currency: SEK },
    });

    expect(
      sheet(wrapper)
        .findAll('[data-testid="line-specification-price-row"]')[1]
        ?.text(),
    ).toContain('configurator.panel.vat_no_rate');
  });

  it('shows no price at all where the buyer may not see prices', async () => {
    setFeatures({ priceVisibility: { enabled: false } });

    const wrapper = await opened();

    expect(
      sheet(wrapper)
        .find('[data-testid="line-specification-price-row"]')
        .exists(),
    ).toBe(false);
    expect(sheet(wrapper).text()).not.toMatch(/1,870|619/);
    expect(sheet(wrapper).text()).toContain('S45');
  });

  it('shows no footer for a line without a total', async () => {
    const wrapper = await opened({ totalPrice: undefined });

    expect(
      sheet(wrapper)
        .find('[data-testid="line-specification-price-row"]')
        .exists(),
    ).toBe(false);
  });

  it('falls back to the summary list for a line committed before its structure was recorded', async () => {
    const wrapper = await opened({
      configuration: {
        summary: [
          { label: 'Adapter', value: 'S45' },
          { label: 'Width', value: '1200.00 mm' },
          { label: 'Finish', value: '' },
        ],
      },
    });

    expect(sheet(wrapper).findAll('h4')).toHaveLength(0);
    // In the order given, an empty value too.
    expect(
      sheet(wrapper)
        .findAll('[data-testid="line-specification-summary-row"]')
        .map((row) => [row.find('dt').text(), row.find('dd').text()]),
    ).toEqual([
      ['Adapter', 'S45'],
      ['Width', '1200.00 mm'],
      ['Finish', ''],
    ]);
    expect(
      sheet(wrapper)
        .find('[data-testid="line-specification-default"]')
        .exists(),
    ).toBe(false);
  });

  it('falls back to the summary where the recorded structure holds nothing to show', async () => {
    const wrapper = await opened({
      configuration: {
        summary: [{ label: 'Adapter', value: 'S45' }],
        sections: [],
      },
    });

    expect(
      sheet(wrapper).findAll('[data-testid="line-specification-summary-row"]'),
    ).toHaveLength(1);
  });

  it('says the line has the standard configuration where nothing was chosen', async () => {
    const wrapper = await opened({ configuration: { summary: [] } });

    expect(
      sheet(wrapper).find('[data-testid="line-specification-default"]').text(),
    ).toBe('cart.default_configuration');
    expect(
      sheet(wrapper)
        .find('[data-testid="line-specification-summary"]')
        .exists(),
    ).toBe(false);
  });

  it('closes, and opens again', async () => {
    const wrapper = await opened();

    await wrapper.find('[data-testid="sheet-close"]').trigger('click');
    expect(sheet(wrapper).exists()).toBe(false);

    await trigger(wrapper).trigger('click');
    expect(sheet(wrapper).exists()).toBe(true);
  });
});

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
import { mockShowIncVat } from '../../setup-components';

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
    mockShowIncVat.value = false;
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
    // Four teeth at 619.49, so the row says what the four cost.
    expect(values[1]).toMatch(
      /^J250 Bucket Teeth · configurator\.panel\.quantity_suffix 4\s*\+.*2,477\.96$/,
    );
    expect(values[2]).toBe('1,200 mm');
  });

  it('writes a quantity other than one in the number format of the locale', async () => {
    const wrapper = await opened({
      configuration: {
        summary: [],
        sections: [
          {
            name: 'Material',
            sortIndex: 1,
            variables: [],
            optionGroups: [
              {
                id: 'steel',
                name: 'Steel',
                sortIndex: 1,
                options: [
                  {
                    name: 'Plate',
                    quantity: 0.0735,
                    unitPrice: { sellingPriceExVat: 1000, currency: SEK },
                  },
                  {
                    name: 'Bolt',
                    quantity: 1234.5,
                    unitPrice: { sellingPriceExVat: 1, currency: SEK },
                  },
                ],
                optionGroups: [],
              },
            ],
            sections: [],
          },
        ],
      },
    });

    const values = sheet(wrapper)
      .findAll('dd')
      .map((dd) => plain(dd.text()));
    expect(values[0]).toMatch(
      /^Plate · configurator\.panel\.quantity_suffix 0\.0735\s*\+.*73\.50$/,
    );
    expect(values[1]).toMatch(
      /^Bolt · configurator\.panel\.quantity_suffix 1,234\.5\s*\+.*1,234\.50$/,
    );
  });

  const priceRows = (wrapper: ReturnType<typeof mountLine>) =>
    sheet(wrapper)
      .findAll('[data-testid="line-specification-price-row"]')
      .map((row) =>
        plain(
          row
            .findAll(':scope > span')
            .map((part) => part.text())
            .join(' '),
        ).replace(/\s+/g, ' '),
      );

  it('totals the line from its own total on the ex side: price, VAT, total with VAT', async () => {
    const rows = priceRows(await opened());

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(
      /^configurator\.panel\.price · configurator\.panel\.quantity_suffix 2 SEK 5,422\.16$/,
    );
    expect(rows[1]).toBe('common.vat SEK 1,355.54');
    expect(rows[2]).toBe('configurator.panel.total_inc_vat SEK 6,777.70');
  });

  it('leads with the total with VAT on the inc side, then the VAT in it', async () => {
    mockShowIncVat.value = true;
    const rows = priceRows(await opened());

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatch(
      /^configurator\.panel\.price · configurator\.panel\.quantity_suffix 2 SEK 6,777\.70$/,
    );
    expect(rows[1]).toBe('common.vat_included SEK 1,355.54');
  });

  it('writes no VAT rate on either side', async () => {
    const ex = priceRows(await opened());
    mockShowIncVat.value = true;
    const inc = priceRows(await opened());

    expect([...ex, ...inc].join(' ')).not.toMatch(/%|25 /);
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

  describe('base price', () => {
    // 1870.20 + 4 × 619.49 = 4348.16 of options against 5000 a unit.
    const GAP_UNIT: PriceType = {
      sellingPriceExVat: 5000,
      vat: 1250,
      sellingPriceIncVat: 6250,
      currency: SEK,
    };
    const base = (wrapper: ReturnType<typeof mountLine>) =>
      sheet(wrapper).find('[data-testid="specification-base-price"]');

    it('writes the remainder of one unit as a row above the first section', async () => {
      const wrapper = await opened({ unitPrice: GAP_UNIT });

      expect(plain(base(wrapper).text()).replace(/\s+/g, ' ')).toMatch(
        /^configurator\.panel\.base_price\s*SEK 651\.84$/,
      );
      const heading = sheet(wrapper).find('h4');
      expect(
        base(wrapper).element.compareDocumentPosition(heading.element) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('writes the rows and the remainder with VAT on the inc side, adding up to the unit', async () => {
      mockShowIncVat.value = true;
      const machine = WITH_SECTIONS.sections![1]!;
      const adapter = machine.optionGroups[0]!;
      const withVat: LineConfigurationSummary = {
        ...WITH_SECTIONS,
        sections: [
          WITH_SECTIONS.sections![0]!,
          {
            ...machine,
            optionGroups: [
              {
                ...adapter,
                options: [
                  {
                    ...adapter.options[0]!,
                    unitPrice: {
                      sellingPriceExVat: 1870.2,
                      sellingPriceIncVat: 2337.75,
                      currency: SEK,
                    },
                  },
                  {
                    ...adapter.options[1]!,
                    unitPrice: {
                      sellingPriceExVat: 619.49,
                      sellingPriceIncVat: 774.36,
                      currency: SEK,
                    },
                  },
                ],
              },
            ],
          },
        ],
      };
      const wrapper = await opened({
        configuration: withVat,
        unitPrice: GAP_UNIT,
      });

      // 6250 − 2337.75 − 4 × 774.36 = 814.81.
      expect(plain(base(wrapper).text())).toContain('SEK 814.81');
      const values = sheet(wrapper)
        .findAll('dd')
        .map((dd) => plain(dd.text()));
      expect(values[0]).toMatch(/\+SEK 2,337\.75$/);
      expect(values[1]).toMatch(/\+SEK 3,097\.44$/);
    });

    it('shows the row at zero where the options make up the unit price', async () => {
      const wrapper = await opened({
        unitPrice: { sellingPriceExVat: 4348.16, currency: SEK },
      });

      expect(plain(base(wrapper).text())).toContain('SEK 0.00');
    });

    it('shows no row where the options exceed the unit price', async () => {
      const wrapper = await opened();

      expect(base(wrapper).exists()).toBe(false);
    });

    it('shows no row where the buyer may not see prices', async () => {
      setFeatures({ priceVisibility: { enabled: false } });

      const wrapper = await opened({ unitPrice: GAP_UNIT });

      expect(base(wrapper).exists()).toBe(false);
    });

    it('shows no row on a line committed before its structure was recorded', async () => {
      const wrapper = await opened({
        unitPrice: GAP_UNIT,
        configuration: { summary: [{ label: 'Adapter', value: 'S45' }] },
      });

      expect(base(wrapper).exists()).toBe(false);
      expect(
        sheet(wrapper).findAll(
          '[data-testid="line-specification-summary-row"]',
        ),
      ).toHaveLength(1);
    });

    it('shows no row where the recorded sections hold no choice but the summary names some', async () => {
      const wrapper = await opened({
        unitPrice: GAP_UNIT,
        configuration: {
          summary: [{ label: 'Adapter', value: 'S45' }],
          sections: [
            {
              name: 'Machine',
              sortIndex: 1,
              variables: [],
              optionGroups: [],
              sections: [],
            },
          ],
        },
      });

      expect(base(wrapper).exists()).toBe(false);
      expect(
        sheet(wrapper).findAll(
          '[data-testid="line-specification-summary-row"]',
        ),
      ).toHaveLength(1);
    });

    it('shows the row above the standard text where the recorded sections are empty', async () => {
      const wrapper = await opened({
        unitPrice: GAP_UNIT,
        configuration: { summary: [], sections: [] },
      });

      expect(plain(base(wrapper).text())).toContain('SEK 5,000.00');
      const standard = sheet(wrapper).find(
        '[data-testid="line-specification-default"]',
      );
      expect(standard.text()).toBe('cart.default_configuration');
      expect(
        base(wrapper).element.compareDocumentPosition(standard.element) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  it('closes, and opens again', async () => {
    const wrapper = await opened();

    await wrapper.find('[data-testid="sheet-close"]').trigger('click');
    expect(sheet(wrapper).exists()).toBe(false);

    await trigger(wrapper).trigger('click');
    expect(sheet(wrapper).exists()).toBe(true);
  });
});

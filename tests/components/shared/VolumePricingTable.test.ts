import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import VolumePricingTable from '../../../app/components/shared/VolumePricingTable.vue';

function makeTier(
  quantity: number,
  discountPercentage: number,
  sellingPriceIncVat: number,
  sellingPriceExVat: number,
) {
  return {
    quantity,
    discount: sellingPriceIncVat * (discountPercentage / 100),
    discountPercentage,
    price: {
      sellingPriceIncVat,
      sellingPriceIncVatFormatted: `${sellingPriceIncVat} kr`,
      sellingPriceExVat,
      sellingPriceExVatFormatted: `${sellingPriceExVat} kr`,
      currency: { code: 'SEK', symbol: 'kr' },
    },
  };
}

describe('VolumePricingTable', () => {
  it('renders table with multiple tiers', () => {
    const prices = [
      makeTier(5, 5, 95, 76),
      makeTier(10, 10, 90, 72),
      makeTier(25, 15, 85, 68),
    ];

    const wrapper = mountComponent(VolumePricingTable, {
      props: { prices },
    });

    expect(wrapper.find('table').exists()).toBe(true);
    const rows = wrapper.findAll('tbody tr');
    expect(rows.length).toBe(3);
    expect(rows[0].text()).toContain('5+');
    expect(rows[0].text()).toContain('-5%');
    expect(rows[2].text()).toContain('25+');
    expect(rows[2].text()).toContain('-15%');
  });

  it('renders nothing when prices is empty', () => {
    const wrapper = mountComponent(VolumePricingTable, {
      props: { prices: [] },
    });

    expect(wrapper.find('table').exists()).toBe(false);
    expect(wrapper.text()).toBe('');
  });

  it('renders nothing when prices has only 1 tier', () => {
    const wrapper = mountComponent(VolumePricingTable, {
      props: { prices: [makeTier(1, 0, 100, 80)] },
    });

    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('shows inc VAT prices by default', () => {
    const prices = [makeTier(5, 5, 95, 76), makeTier(10, 10, 90, 72)];

    const wrapper = mountComponent(VolumePricingTable, {
      props: { prices },
    });

    const firstRow = wrapper.findAll('tbody tr')[0];
    expect(firstRow.text()).toContain('95 kr');
  });

  it('shows ex VAT prices when showVat is false', () => {
    const prices = [makeTier(5, 5, 95, 76), makeTier(10, 10, 90, 72)];

    const wrapper = mountComponent(VolumePricingTable, {
      props: { prices, showVat: false },
    });

    const firstRow = wrapper.findAll('tbody tr')[0];
    expect(firstRow.text()).toContain('76 kr');
  });

  it('shows the section title', () => {
    const prices = [makeTier(5, 5, 95, 76), makeTier(10, 10, 90, 72)];

    const wrapper = mountComponent(VolumePricingTable, {
      props: { prices },
    });

    expect(wrapper.text()).toContain('discount.volume_pricing');
  });
});

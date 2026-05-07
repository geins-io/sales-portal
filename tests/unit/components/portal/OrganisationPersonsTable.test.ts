// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import type { CompanyBuyer } from '../../../../shared/types/company';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: ref('en'),
  }),
}));

vi.stubGlobal('useI18n', () => ({
  t: (key: string) => key,
  locale: ref('en'),
}));

const OrganisationPersonsTable =
  await import('../../../../app/components/portal/OrganisationPersonsTable.vue');

function makeBuyer(overrides: Partial<CompanyBuyer> = {}): CompanyBuyer {
  return {
    id: 'buyer-1',
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+46701234567',
    companyId: 'company-1',
    active: true,
    restrictToDedicatedPriceLists: false,
    ...overrides,
  };
}

describe('OrganisationPersonsTable', () => {
  it('renders exactly 4 column headers: ID, Name, Phone, Active', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer()] },
    });
    const headers = wrapper.findAll('th');
    expect(headers).toHaveLength(4);
  });

  it('renders ID column header', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer()] },
    });
    const headerText = wrapper
      .findAll('th')
      .map((h) => h.text())
      .join(' ');
    expect(headerText).toContain('portal.org.persons.col_id');
  });

  it('renders Name column header', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer()] },
    });
    const headerText = wrapper
      .findAll('th')
      .map((h) => h.text())
      .join(' ');
    expect(headerText).toContain('portal.org.persons.col_name');
  });

  it('renders Phone column header', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer()] },
    });
    const headerText = wrapper
      .findAll('th')
      .map((h) => h.text())
      .join(' ');
    expect(headerText).toContain('portal.org.persons.col_phone');
  });

  it('renders Active column header', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer()] },
    });
    const headerText = wrapper
      .findAll('th')
      .map((h) => h.text())
      .join(' ');
    expect(headerText).toContain('portal.org.persons.col_active');
  });

  it('does NOT render Email, Role, or Latest login headers', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer()] },
    });
    const text = wrapper.text().toLowerCase();
    expect(text).not.toContain('email');
    expect(text).not.toContain('role');
    expect(text).not.toContain('latest login');
    expect(text).not.toContain('last login');
  });

  it('renders buyer id in the row', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer({ id: 'buyer-abc' })] },
    });
    expect(wrapper.text()).toContain('buyer-abc');
  });

  it('renders full name from firstName + lastName', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer({ firstName: 'Jane', lastName: 'Doe' })] },
    });
    expect(wrapper.text()).toContain('Jane Doe');
  });

  it('falls back to dash when both firstName and lastName are missing', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer({ firstName: null, lastName: null })] },
    });
    expect(wrapper.text()).toContain('—');
  });

  it('renders phone in the row', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer({ phone: '+46701234567' })] },
    });
    expect(wrapper.text()).toContain('+46701234567');
  });

  it('falls back to dash when phone is absent', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer({ phone: null })] },
    });
    expect(wrapper.text()).toContain('—');
  });

  it('active buyer pill has different class than inactive pill', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: {
        buyers: [
          makeBuyer({ id: 'a', active: true }),
          makeBuyer({ id: 'b', active: false }),
        ],
      },
    });
    const pills = wrapper.findAll('[data-testid="buyer-status-pill"]');
    expect(pills).toHaveLength(2);
    const activeClass = pills[0].classes().join(' ');
    const inactiveClass = pills[1].classes().join(' ');
    expect(activeClass).not.toBe(inactiveClass);
  });

  it('renders no button element (no add/edit actions)', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer()] },
    });
    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('renders empty state when buyers is empty', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [] },
    });
    expect(wrapper.text()).toContain('portal.org.persons.empty');
  });

  it('uses semantic table with thead', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer()] },
    });
    expect(wrapper.find('table').exists()).toBe(true);
    expect(wrapper.find('thead').exists()).toBe(true);
  });

  it('th elements have scope="col"', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer()] },
    });
    const ths = wrapper.findAll('th');
    ths.forEach((th) => {
      expect(th.attributes('scope')).toBe('col');
    });
  });
});

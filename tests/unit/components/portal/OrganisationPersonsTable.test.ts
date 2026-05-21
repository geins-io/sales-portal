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
    id: 'jane@acme.com',
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
  it('renders three column headers: Id, Email, Latest login', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer()] },
    });
    const headers = wrapper.findAll('th').map((h) => h.text());
    expect(headers).toHaveLength(3);
    expect(headers[0]).toContain('portal.org.persons.col_id');
    expect(headers[1]).toContain('portal.org.persons.col_email');
    expect(headers[2]).toContain('portal.org.persons.col_latest_login');
  });

  it('renders the buyer id in the email column', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer({ id: 'buyer.abc@example.com' })] },
    });
    expect(wrapper.text()).toContain('buyer.abc@example.com');
  });

  it('renders dashes for id and latest login columns (Geins gap)', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer()] },
    });
    const cells = wrapper.findAll('tbody td').map((td) => td.text());
    expect(cells[0]).toBe('—');
    expect(cells[2]).toBe('—');
  });

  it('renders no name, phone, or active pill', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: {
        buyers: [
          makeBuyer({ firstName: 'Jane', lastName: 'Doe', phone: '+4670' }),
        ],
      },
    });
    expect(wrapper.text()).not.toContain('Jane Doe');
    expect(wrapper.text()).not.toContain('+4670');
    expect(wrapper.find('[data-testid="buyer-status-pill"]').exists()).toBe(
      false,
    );
  });

  it('wraps the table in a bordered card', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer()] },
    });
    const wrapperDiv = wrapper.find('table').element.parentElement;
    expect(wrapperDiv?.className).toContain('border');
    expect(wrapperDiv?.className).toContain('rounded-lg');
  });

  it('renders empty state when buyers is empty', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [] },
    });
    expect(wrapper.text()).toContain('portal.org.persons.empty');
    expect(wrapper.find('table').exists()).toBe(false);
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

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
    internalId: '8421',
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
  it('renders two column headers: Id, Email', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer()] },
    });
    const headers = wrapper.findAll('th').map((h) => h.text());
    expect(headers).toHaveLength(2);
    expect(headers[0]).toContain('portal.org.persons.col_id');
    expect(headers[1]).toContain('portal.org.persons.col_email');
  });

  it('renders internalId in the Id column', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer({ internalId: '8421' })] },
    });
    const cells = wrapper.findAll('tbody td').map((td) => td.text());
    expect(cells[0]).toBe('8421');
  });

  it('falls back to hyphen when internalId is missing', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer({ internalId: null })] },
    });
    const cells = wrapper.findAll('tbody td').map((td) => td.text());
    expect(cells[0]).toBe('-');
  });

  it('renders the email in the email column', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer({ id: 'buyer.abc@example.com' })] },
    });
    expect(wrapper.text()).toContain('buyer.abc@example.com');
  });

  it('does not render a Latest login column or em dash fallback', () => {
    const wrapper = mount(OrganisationPersonsTable.default, {
      props: { buyers: [makeBuyer()] },
    });
    expect(wrapper.text()).not.toContain('col_latest_login');
    expect(wrapper.text()).not.toContain('—');
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

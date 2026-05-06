// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import type { Company } from '../../../../shared/types/company';

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

const stubs = {
  AddressBlock: {
    template: '<div data-testid="address-block" :data-label="label"></div>',
    props: ['label', 'address', 'icon'],
  },
  Icon: {
    template: '<span class="icon" :data-name="name"></span>',
    props: ['name'],
  },
};

const OrganisationGeneralSettings =
  await import('../../../../app/components/portal/OrganisationGeneralSettings.vue');

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'company-1',
    name: 'Acme AB',
    vatNumber: 'SE556677889901',
    exVat: true,
    limitedProductAccess: false,
    addresses: [],
    buyers: [],
    ...overrides,
  };
}

describe('OrganisationGeneralSettings', () => {
  it('renders company name field', () => {
    const wrapper = mount(OrganisationGeneralSettings.default, {
      props: { company: makeCompany() },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Acme AB');
  });

  it('renders company id field', () => {
    const wrapper = mount(OrganisationGeneralSettings.default, {
      props: { company: makeCompany({ id: 'company-1' }) },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('company-1');
  });

  it('renders vat number field', () => {
    const wrapper = mount(OrganisationGeneralSettings.default, {
      props: { company: makeCompany({ vatNumber: 'SE556677889901' }) },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('SE556677889901');
  });

  it('renders exVat indicator label', () => {
    const wrapper = mount(OrganisationGeneralSettings.default, {
      props: { company: makeCompany({ exVat: true }) },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('portal.org.info.ex_vat');
  });

  it('renders limitedProductAccess indicator label', () => {
    const wrapper = mount(OrganisationGeneralSettings.default, {
      props: { company: makeCompany({ limitedProductAccess: false }) },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('portal.org.info.limited_product_access');
  });

  it('renders an AddressBlock for each address', () => {
    const company = makeCompany({
      addresses: [
        {
          addressId: 'addr-1',
          companyId: 'company-1',
          email: null,
          phone: null,
          company: 'Acme AB',
          firstName: 'Jane',
          lastName: 'Doe',
          careOf: null,
          addressLine1: 'Street 1',
          addressLine2: null,
          addressLine3: null,
          zip: '12345',
          city: 'Stockholm',
          region: null,
          country: 'SE',
          addressType: 'billing',
          addressReferenceId: null,
        },
        {
          addressId: 'addr-2',
          companyId: 'company-1',
          email: null,
          phone: null,
          company: 'Acme AB',
          firstName: 'John',
          lastName: 'Doe',
          careOf: null,
          addressLine1: 'Street 2',
          addressLine2: null,
          addressLine3: null,
          zip: '67890',
          city: 'Gothenburg',
          region: null,
          country: 'SE',
          addressType: 'shipping',
          addressReferenceId: null,
        },
      ],
    });
    const wrapper = mount(OrganisationGeneralSettings.default, {
      props: { company },
      global: { stubs },
    });
    const blocks = wrapper.findAll('[data-testid="address-block"]');
    expect(blocks).toHaveLength(2);
  });

  it('renders no button element (read-only invariant)', () => {
    const wrapper = mount(OrganisationGeneralSettings.default, {
      props: { company: makeCompany() },
      global: { stubs },
    });
    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('renders no input element (read-only invariant)', () => {
    const wrapper = mount(OrganisationGeneralSettings.default, {
      props: { company: makeCompany() },
      global: { stubs },
    });
    expect(wrapper.find('input').exists()).toBe(false);
  });
});

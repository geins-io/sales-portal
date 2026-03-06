import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountComponent } from '../../utils/component';
import OrgAddressBook from '../../../app/components/portal/org/OrgAddressBook.vue';
import type { OrgAddress } from '#shared/types/b2b';

const iconStub = {
  template: '<span class="icon" :data-name="name"></span>',
  props: ['name'],
};

const stubs = {
  Icon: iconStub,
  NuxtIcon: iconStub,
  Button: {
    template:
      '<button :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot /></button>',
    inheritAttrs: false,
  },
  OrgAddressForm: {
    template: '<div data-testid="address-form-stub"></div>',
    emits: ['saved', 'cancel'],
  },
};

const mockAddresses: OrgAddress[] = [
  {
    id: 'addr-1',
    organizationId: 'org-1',
    label: 'Headquarters',
    isDefault: true,
    address: {
      firstName: 'Jane',
      lastName: 'Doe',
      addressLine1: 'Storgatan 1',
      postalCode: '111 22',
      city: 'Stockholm',
      country: 'Sweden',
      phone: '+46701234567',
    },
  },
  {
    id: 'addr-2',
    organizationId: 'org-1',
    label: 'Warehouse',
    isDefault: false,
    address: {
      addressLine1: 'Industrivägen 5',
      postalCode: '333 44',
      city: 'Gothenburg',
      country: 'Sweden',
    },
  },
];

describe('OrgAddressBook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders address book container', () => {
    const wrapper = mountComponent(OrgAddressBook, {
      props: { addresses: mockAddresses, canManage: false },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="org-address-book"]').exists()).toBe(
      true,
    );
  });

  it('renders address cards', () => {
    const wrapper = mountComponent(OrgAddressBook, {
      props: { addresses: mockAddresses, canManage: false },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="address-card-addr-1"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="address-card-addr-2"]').exists()).toBe(
      true,
    );
  });

  it('renders address label', () => {
    const wrapper = mountComponent(OrgAddressBook, {
      props: { addresses: mockAddresses, canManage: false },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Headquarters');
    expect(wrapper.text()).toContain('Warehouse');
  });

  it('renders default badge on default address', () => {
    const wrapper = mountComponent(OrgAddressBook, {
      props: { addresses: mockAddresses, canManage: false },
      global: { stubs },
    });
    const card1 = wrapper.find('[data-testid="address-card-addr-1"]');
    expect(card1.find('[data-testid="address-default-badge"]').exists()).toBe(
      true,
    );
    const card2 = wrapper.find('[data-testid="address-card-addr-2"]');
    expect(card2.find('[data-testid="address-default-badge"]').exists()).toBe(
      false,
    );
  });

  it('renders contact name when present', () => {
    const wrapper = mountComponent(OrgAddressBook, {
      props: { addresses: mockAddresses, canManage: false },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Jane Doe');
  });

  it('renders formatted address', () => {
    const wrapper = mountComponent(OrgAddressBook, {
      props: { addresses: mockAddresses, canManage: false },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Storgatan 1');
    expect(wrapper.text()).toContain('Stockholm');
  });

  it('shows add button when canManage is true', () => {
    const wrapper = mountComponent(OrgAddressBook, {
      props: { addresses: mockAddresses, canManage: true },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="address-add-btn"]').exists()).toBe(true);
  });

  it('hides add button when canManage is false', () => {
    const wrapper = mountComponent(OrgAddressBook, {
      props: { addresses: mockAddresses, canManage: false },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="address-add-btn"]').exists()).toBe(
      false,
    );
  });

  it('shows edit and remove buttons when canManage is true', () => {
    const wrapper = mountComponent(OrgAddressBook, {
      props: { addresses: mockAddresses, canManage: true },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="address-edit-addr-1"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="address-remove-addr-1"]').exists()).toBe(
      true,
    );
  });

  it('hides edit and remove buttons when canManage is false', () => {
    const wrapper = mountComponent(OrgAddressBook, {
      props: { addresses: mockAddresses, canManage: false },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="address-edit-addr-1"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="address-remove-addr-1"]').exists()).toBe(
      false,
    );
  });

  it('shows empty state when no addresses', () => {
    const wrapper = mountComponent(OrgAddressBook, {
      props: { addresses: [], canManage: false },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="address-empty"]').exists()).toBe(true);
  });

  it('shows remove confirmation when remove is clicked', async () => {
    const wrapper = mountComponent(OrgAddressBook, {
      props: { addresses: mockAddresses, canManage: true },
      global: { stubs },
    });
    await wrapper
      .find('[data-testid="address-remove-addr-1"]')
      .trigger('click');
    expect(
      wrapper.find('[data-testid="address-confirm-remove"]').exists(),
    ).toBe(true);
  });

  it('cancels remove confirmation', async () => {
    const wrapper = mountComponent(OrgAddressBook, {
      props: { addresses: mockAddresses, canManage: true },
      global: { stubs },
    });
    await wrapper
      .find('[data-testid="address-remove-addr-1"]')
      .trigger('click');
    expect(
      wrapper.find('[data-testid="address-confirm-remove"]').exists(),
    ).toBe(true);
    await wrapper.find('[data-testid="address-confirm-no"]').trigger('click');
    expect(
      wrapper.find('[data-testid="address-confirm-remove"]').exists(),
    ).toBe(false);
  });
});

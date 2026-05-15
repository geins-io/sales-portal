import { describe, it, expect, vi } from 'vitest';
import { ref, computed } from 'vue';
import { mountComponent } from '../../utils/component';
import ContactPage from '../../../app/pages/contact.vue';
import type { PublicTenantConfig } from '#shared/types/tenant-config';

const mockTenantContact = ref<PublicTenantConfig['contact']>(null);

vi.mock('../../../app/composables/useTenant', () => ({
  useTenant: () => ({
    contact: mockTenantContact,
  }),
}));

vi.mock('../../../app/composables/useCmsMenu', () => ({
  useCmsMenu: () => computed(() => ({ menuLocationId: 'info-pages' })),
}));

const stubs = {
  PageSidebarNav: { template: '<aside class="sidebar-stub" />' },
  ErrorBoundary: { template: '<div><slot /></div>' },
  ContactForm: { template: '<div class="contact-form-stub" />' },
};

function mount() {
  return mountComponent(ContactPage, { global: { stubs } });
}

describe('contact page', () => {
  it('renders i18n fallbacks when tenant has no contact block', () => {
    mockTenantContact.value = null;
    const wrapper = mount();
    expect(wrapper.find('[data-testid="contact-address"]').text()).toBe(
      'contact.company_address',
    );
    expect(wrapper.find('[data-testid="contact-city"]').text()).toBe(
      'contact.company_postal',
    );
    expect(wrapper.find('[data-testid="contact-phone"]').text()).toBe(
      'contact.company_phone',
    );
    expect(wrapper.find('[data-testid="contact-email"]').text()).toBe(
      'contact.company_email',
    );
    expect(wrapper.find('[data-testid="contact-country"]').exists()).toBe(
      false,
    );
  });

  it('renders tenant.contact.email when present', () => {
    mockTenantContact.value = {
      email: 'hello@example.com',
      phone: null,
      address: null,
      social: null,
    };
    const wrapper = mount();
    expect(wrapper.find('[data-testid="contact-email"]').text()).toBe(
      'hello@example.com',
    );
  });

  it('falls back to i18n key when tenant.contact.email is null', () => {
    mockTenantContact.value = {
      email: null,
      phone: '+46 8 123 456',
      address: null,
      social: null,
    };
    const wrapper = mount();
    expect(wrapper.find('[data-testid="contact-email"]').text()).toBe(
      'contact.company_email',
    );
    expect(wrapper.find('[data-testid="contact-phone"]').text()).toBe(
      '+46 8 123 456',
    );
  });

  it('renders structured address: street, postal + city, country', () => {
    mockTenantContact.value = {
      email: null,
      phone: null,
      address: {
        street: 'Streetname 1',
        postalCode: '111 22',
        city: 'Stockholm',
        country: 'Sweden',
      },
      social: null,
    };
    const wrapper = mount();
    expect(wrapper.find('[data-testid="contact-address"]').text()).toBe(
      'Streetname 1',
    );
    expect(wrapper.find('[data-testid="contact-city"]').text()).toBe(
      '111 22 Stockholm',
    );
    expect(wrapper.find('[data-testid="contact-country"]').text()).toBe(
      'Sweden',
    );
  });

  it('omits country row when address.country is null', () => {
    mockTenantContact.value = {
      email: null,
      phone: null,
      address: { street: 'Foo', postalCode: '111', city: 'Bar', country: null },
      social: null,
    };
    const wrapper = mount();
    expect(wrapper.find('[data-testid="contact-country"]').exists()).toBe(
      false,
    );
  });
});

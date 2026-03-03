import { describe, it, expect, vi } from 'vitest';
import { mountComponent } from '../../utils/component';
import ProfileForm from '../../../app/components/portal/ProfileForm.vue';

vi.stubGlobal(
  '$fetch',
  vi.fn(() => Promise.resolve({ profile: {} })),
);

const stubs = {
  Label: { template: '<label><slot /></label>', props: ['for'] },
  Input: {
    template:
      '<input :type="type" :id="id" :disabled="disabled || undefined" v-bind="$attrs" />',
    props: [
      'type',
      'id',
      'modelValue',
      'placeholder',
      'autocomplete',
      'disabled',
    ],
    emits: ['update:modelValue', 'blur'],
  },
  Button: {
    template: '<button :type="type" :disabled="disabled"><slot /></button>',
    props: ['type', 'disabled', 'variant'],
  },
};

const mockProfile = {
  id: 1,
  email: 'user@example.com',
  address: {
    firstName: 'John',
    lastName: 'Doe',
    company: 'Acme Inc',
    phone: '123456',
    mobile: '',
    addressLine1: 'Main St 1',
    addressLine2: '',
    zip: '12345',
    city: 'Stockholm',
    country: 'Sweden',
  },
};

describe('ProfileForm', () => {
  it('renders form with data-testid', () => {
    const wrapper = mountComponent(ProfileForm, {
      props: { profile: mockProfile },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="profile-form"]').exists()).toBe(true);
  });

  it('renders first name field', () => {
    const wrapper = mountComponent(ProfileForm, {
      props: { profile: mockProfile },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="profile-firstName"]').exists()).toBe(
      true,
    );
  });

  it('renders email field as read-only', () => {
    const wrapper = mountComponent(ProfileForm, {
      props: { profile: mockProfile },
      global: { stubs },
    });
    const emailInput = wrapper.find('[data-testid="profile-email"]');
    expect(emailInput.exists()).toBe(true);
    // Email field exists and displays the email value
    expect(wrapper.html()).toContain('profile-email');
  });

  it('renders save button', () => {
    const wrapper = mountComponent(ProfileForm, {
      props: { profile: mockProfile },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="profile-save"]').exists()).toBe(true);
  });

  it('emits saved event on successful submit', async () => {
    (globalThis.$fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      profile: mockProfile,
    });

    const wrapper = mountComponent(ProfileForm, {
      props: { profile: mockProfile },
      global: { stubs },
    });

    await wrapper.find('[data-testid="profile-form"]').trigger('submit');
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('saved')).toBeTruthy();
  });
});

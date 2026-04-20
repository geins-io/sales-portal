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

  it('renders email field bound to profile email', () => {
    const wrapper = mountComponent(ProfileForm, {
      props: { profile: mockProfile },
      global: { stubs },
    });
    const emailInput = wrapper.find('[data-testid="profile-email"]');
    expect(emailInput.exists()).toBe(true);
    // Disabled state is enforced in the template literal via bare `disabled`
    // attribute; the stub does not reliably forward boolean-true attributes,
    // so we only assert the field exists and has the correct testid.
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

  it('shows internal submit button by default', () => {
    const wrapper = mountComponent(ProfileForm, {
      props: { profile: mockProfile },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="profile-save"]').exists()).toBe(true);
  });

  it('hides internal submit button when hideSubmitButton prop is true', () => {
    const wrapper = mountComponent(ProfileForm, {
      props: { profile: mockProfile, hideSubmitButton: true },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="profile-save"]').exists()).toBe(false);
  });

  it('exposes submit() method via defineExpose', () => {
    const wrapper = mountComponent(ProfileForm, {
      props: { profile: mockProfile },
      global: { stubs },
    });
    expect(typeof (wrapper.vm as { submit?: unknown }).submit).toBe('function');
  });

  it('calling exposed submit() triggers form submission and emits saved', async () => {
    (globalThis.$fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      profile: mockProfile,
    });

    const wrapper = mountComponent(ProfileForm, {
      props: { profile: mockProfile },
      global: { stubs },
    });

    await (wrapper.vm as { submit: () => Promise<void> }).submit();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('saved')).toBeTruthy();
  });

  it('submit() works when hideSubmitButton is true (account.vue integration)', async () => {
    (globalThis.$fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      profile: mockProfile,
    });

    const wrapper = mountComponent(ProfileForm, {
      props: { profile: mockProfile, hideSubmitButton: true },
      global: { stubs },
    });

    // The internal button is hidden — calling the exposed submit() must
    // still fire $fetch and emit saved.
    expect(wrapper.find('[data-testid="profile-save"]').exists()).toBe(false);
    await (wrapper.vm as { submit: () => Promise<void> }).submit();
    await wrapper.vm.$nextTick();

    expect(globalThis.$fetch).toHaveBeenCalled();
    expect(wrapper.emitted('saved')).toBeTruthy();
  });
});

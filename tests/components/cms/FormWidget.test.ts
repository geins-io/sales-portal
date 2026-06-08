import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountComponent } from '../../utils/component';
import type { FormWidgetData } from '#shared/types/cms';
import FormWidget from '../../../app/components/cms/widgets/FormWidget.vue';

// Hoist the navigateTo mock so it is available at module eval time.
// safeLocationRedirect delegates to navigateTo({ external: true }), so
// spying on navigateTo lets us assert the mailto URL without touching real
// window.location.
const { navigateToMock } = vi.hoisted(() => ({
  navigateToMock: vi.fn(() => Promise.resolve()),
}));

vi.stubGlobal('navigateTo', (...args: unknown[]) => navigateToMock(...args));

// Mock the client-helpers module so safeLocationRedirect calls navigateTo
// regardless of import.meta.client value (which is false in tests).
vi.mock('../../../app/utils/client-helpers', () => ({
  safeLocationRedirect: (url: string) =>
    navigateToMock(url, { external: true }),
  safeConfirm: vi.fn(() => true),
  safeScrollTo: vi.fn(),
  safeHistoryBack: vi.fn(),
}));

// Stub the i18n-t component so it renders its default slot content.
// In tests, vue-i18n is mocked (useI18n) but <i18n-t> is not auto-registered.
const i18nTStub = {
  template: '<span><slot name="recipient" /></span>',
  props: ['keypath', 'tag'],
};

const sampleFields: FormWidgetData['fields'] = [
  { label: 'Company name', name: 'companyName', required: true, type: 'input' },
  {
    label: 'Organization number',
    name: 'organizationNumber',
    required: true,
    type: 'input',
  },
  { label: 'First name', name: 'firstName', required: true, type: 'input' },
  { label: 'Last name', name: 'lastName', required: true, type: 'input' },
  { label: 'Country', name: 'country', required: true, type: 'select' },
  { label: 'Email', name: 'email', required: true, type: 'email' },
];

const sampleData: FormWidgetData = {
  sendFormToEmail: 'contact@example.com',
  fields: sampleFields,
};

const sampleConfig = {
  name: 'form-widget',
  displayName: 'Account Application Form',
  active: true,
  type: 'JSONPageWidget',
  size: 'full',
  sortOrder: 0,
};

function makeProps(dataOverride?: Partial<FormWidgetData>) {
  return {
    data: { ...sampleData, ...dataOverride },
    config: sampleConfig,
    layout: 'full',
  };
}

function mountWidget(dataOverride?: Partial<FormWidgetData>) {
  return mountComponent(FormWidget, {
    props: makeProps(dataOverride),
    global: {
      stubs: {
        'i18n-t': i18nTStub,
      },
    },
  });
}

describe('FormWidget', () => {
  beforeEach(() => {
    navigateToMock.mockClear();
  });

  it('renders a field for each entry in data.fields', () => {
    const wrapper = mountWidget();
    const fieldGroups = wrapper.findAll('[data-testid^="form-field-"]');
    expect(fieldGroups.length).toBe(6);
  });

  it('renders text input for type input', () => {
    const wrapper = mountWidget();
    const companyInput = wrapper.find(
      '[data-testid="form-field-companyName"] input',
    );
    expect(companyInput.exists()).toBe(true);
    expect(companyInput.attributes('type')).toBe('text');
  });

  it('renders email input for type email', () => {
    const wrapper = mountWidget();
    const emailInput = wrapper.find('[data-testid="form-field-email"] input');
    expect(emailInput.exists()).toBe(true);
    expect(emailInput.attributes('type')).toBe('email');
  });

  it('shows required-field error after blur on an empty required field', async () => {
    const wrapper = mountWidget();
    const companyInput = wrapper.find(
      '[data-testid="form-field-companyName"] input',
    );
    await companyInput.trigger('blur');
    await wrapper.vm.$nextTick();
    const error = wrapper.find('[data-testid="form-field-companyName-error"]');
    expect(error.exists()).toBe(true);
    expect(error.text()).not.toBe('');
  });

  it('shows email-format error after blur with an invalid email', async () => {
    const wrapper = mountWidget();
    const emailInput = wrapper.find('[data-testid="form-field-email"] input');
    await emailInput.setValue('not-an-email');
    await emailInput.trigger('blur');
    await wrapper.vm.$nextTick();
    const error = wrapper.find('[data-testid="form-field-email-error"]');
    expect(error.exists()).toBe(true);
    expect(error.text()).not.toBe('');
  });

  it('does not open mailto when required fields are empty and submit is clicked', async () => {
    const wrapper = mountWidget();
    const submitBtn = wrapper.find('[data-testid="form-submit"]');
    await submitBtn.trigger('click');
    await wrapper.vm.$nextTick();
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it('opens a mailto URL containing the company value on valid submit', async () => {
    const wrapper = mountWidget();

    // Fill all required fields via setValue (triggers reactivity)
    await wrapper
      .find('[data-testid="form-field-companyName"] input')
      .setValue('Acme Corp');
    await wrapper
      .find('[data-testid="form-field-organizationNumber"] input')
      .setValue('556123-4567');
    await wrapper
      .find('[data-testid="form-field-firstName"] input')
      .setValue('Jane');
    await wrapper
      .find('[data-testid="form-field-lastName"] input')
      .setValue('Doe');
    await wrapper
      .find('[data-testid="form-field-email"] input')
      .setValue('jane@acme.com');

    // Drive country select via exposed formValues (Radix Select is not testable in happy-dom)
    const vm = wrapper.vm as unknown as {
      formValues: Record<string, string>;
      handleSubmit: () => void;
    };
    vm.formValues['country'] = 'SE';
    await wrapper.vm.$nextTick();

    // Call handleSubmit directly to bypass the DOM click -> form submit chain
    vm.handleSubmit();
    await wrapper.vm.$nextTick();

    expect(navigateToMock).toHaveBeenCalledTimes(1);
    const calledUrl: string = navigateToMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toMatch(/^mailto:/);
    expect(calledUrl).toContain('Acme');
  });

  it('renders fallback text with the recipient email as a mailto link', () => {
    const wrapper = mountWidget();
    const fallback = wrapper.find('[data-testid="form-fallback"]');
    expect(fallback.exists()).toBe(true);
    const link = fallback.find('a');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('mailto:contact@example.com');
  });
});

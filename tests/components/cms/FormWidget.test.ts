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

// Stub Select components so they render predictable markup in happy-dom.
const selectTriggerStub = {
  template:
    '<button :id="id" :aria-invalid="ariaInvalid" :aria-describedby="ariaDescribedby" :aria-required="ariaRequired" data-testid-stub="select-trigger"><slot /></button>',
  props: ['id', 'ariaInvalid', 'ariaDescribedby', 'ariaRequired', 'class'],
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
        SelectTrigger: selectTriggerStub,
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

  // B3: select branch is exercised — deleting the v-if="field.type==='select'" block would fail this.
  it('renders a SelectTrigger (not a bare input) for type select', () => {
    const wrapper = mountWidget();
    const countryField = wrapper.find('[data-testid="form-field-country"]');
    // Must contain a SelectTrigger stub, not a bare <input>
    expect(
      countryField.find('[data-testid-stub="select-trigger"]').exists(),
    ).toBe(true);
    expect(countryField.find('input').exists()).toBe(false);
  });

  // B4: empty fields array renders no field groups but still shows submit + fallback.
  it('renders no field groups but shows submit and fallback when fields is empty', () => {
    const wrapper = mountWidget({ fields: [] });
    // No data-testid starting with form-field- (those are field groups only)
    const fieldGroups = wrapper.findAll('[data-testid^="form-field-"]');
    expect(fieldGroups.length).toBe(0);
    expect(wrapper.find('[data-testid="form-submit"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="form-fallback"]').exists()).toBe(true);
  });

  // B4: undefined/null-ish data shape does not throw.
  it('renders safely when fields is explicitly an empty array (SSR null-safety)', () => {
    // Pass an object with no fields key to exercise ?? [] safety paths.
    const wrapper = mountComponent(FormWidget, {
      props: {
        data: { sendFormToEmail: 'a@b.com', fields: [] } as FormWidgetData,
        config: sampleConfig,
        layout: 'full',
      },
      global: {
        stubs: {
          'i18n-t': i18nTStub,
          SelectTrigger: selectTriggerStub,
        },
      },
    });
    expect(wrapper.find('[data-testid="form-widget"]').exists()).toBe(true);
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

  // W9: strengthened mailto assertion — decode URL and verify subject + body format.
  it('opens a mailto URL with configured subject (with {field} interpolation) and labelled body on valid submit', async () => {
    const wrapper = mountWidget({
      subject: 'Account application: {companyName}',
    });

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

    // Drive country select via exposed formValues (Radix Select not testable in happy-dom).
    const vm = wrapper.vm as unknown as {
      formValues: Record<string, string>;
      handleSubmit: () => void;
    };
    vm.formValues['country'] = 'SE';
    await wrapper.vm.$nextTick();

    vm.handleSubmit();
    await wrapper.vm.$nextTick();

    expect(navigateToMock).toHaveBeenCalledTimes(1);
    const calledUrl: string = navigateToMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toMatch(/^mailto:/);

    // Decode and verify subject equals the literal business-critical format.
    const decoded = decodeURIComponent(calledUrl);
    expect(decoded).toContain('Account application: Acme Corp');

    // Body must contain at least one "Label: value" line.
    expect(decoded).toMatch(/Company name:\s*Acme Corp/);
  });

  it('falls back to templateName for the subject when none is configured', async () => {
    const wrapper = mountWidget({
      fields: [
        { label: 'Email', name: 'email', required: true, type: 'email' },
      ],
      templateName: 'Contact Form',
    });
    await wrapper
      .find('[data-testid="form-field-email"] input')
      .setValue('jane@acme.com');
    (wrapper.vm as unknown as { handleSubmit: () => void }).handleSubmit();
    await wrapper.vm.$nextTick();
    const decoded = decodeURIComponent(
      navigateToMock.mock.calls[0]?.[0] as string,
    );
    expect(decoded).toContain('Contact Form');
  });

  it('renders a configured submit label', () => {
    const wrapper = mountWidget({ submitLabel: 'Send message' });
    expect(wrapper.find('[data-testid="form-submit"]').text()).toBe(
      'Send message',
    );
  });

  it('renders the neutral default submit label when none is configured', () => {
    // setup-components stubs t() to return the key, so the default resolves to
    // the i18n key rather than the apply-specific copy that used to be hardcoded.
    const wrapper = mountWidget();
    expect(wrapper.find('[data-testid="form-submit"]').text()).toBe(
      'form.submit',
    );
  });

  // W11: textarea branch test.
  it('renders a textarea for type textarea', () => {
    const fields: FormWidgetData['fields'] = [
      { label: 'Message', name: 'message', required: false, type: 'textarea' },
    ];
    const wrapper = mountWidget({ fields });
    const field = wrapper.find('[data-testid="form-field-message"]');
    expect(field.find('textarea').exists()).toBe(true);
    expect(field.find('input').exists()).toBe(false);
  });

  it('renders fallback text with the recipient email as a mailto link', () => {
    const wrapper = mountWidget();
    const fallback = wrapper.find('[data-testid="form-fallback"]');
    expect(fallback.exists()).toBe(true);
    const link = fallback.find('a');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('mailto:contact@example.com');
  });

  it('does not render fallback when sendFormToEmail is absent', () => {
    // W3: no empty mailto: href rendered when recipient is missing.
    const wrapper = mountComponent(FormWidget, {
      props: {
        data: { sendFormToEmail: '', fields: [] } as FormWidgetData,
        config: sampleConfig,
        layout: 'full',
      },
      global: {
        stubs: { 'i18n-t': i18nTStub, SelectTrigger: selectTriggerStub },
      },
    });
    expect(wrapper.find('[data-testid="form-fallback"]').exists()).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import JsonWidget from '../../../app/components/cms/widgets/JsonWidget.vue';

// Stub FormWidget so we can detect when it is rendered without full form logic.
const formWidgetStub = {
  template: '<div data-testid="form-widget-stub" />',
  props: ['data', 'config', 'layout'],
};

// Stub the i18n-t component used inside FormWidget (not rendered here but imported).
const i18nTStub = {
  template: '<span><slot name="recipient" /></span>',
  props: ['keypath', 'tag'],
};

const baseConfig = {
  name: 'json-widget',
  displayName: 'JSON Widget',
  active: true,
  type: 'JSONPageWidget',
  size: 'full' as const,
  sortOrder: 0,
};

function mountJson(data: Record<string, unknown>) {
  return mountComponent(JsonWidget, {
    props: { data, config: baseConfig, layout: 'full' },
    global: {
      stubs: {
        FormWidget: formWidgetStub,
        CmsWidgetsFormWidget: formWidgetStub,
        'i18n-t': i18nTStub,
      },
    },
  });
}

describe('JsonWidget routing', () => {
  // W10: form-shaped data routes to FormWidget.
  it('renders FormWidget when data has sendFormToEmail and fields', () => {
    const wrapper = mountJson({
      sendFormToEmail: 'admin@example.com',
      fields: [
        { label: 'Company', name: 'company', required: true, type: 'input' },
      ],
    });
    expect(wrapper.find('[data-testid="form-widget-stub"]').exists()).toBe(true);
  });

  // W10: non-form data (cards template) does NOT render FormWidget.
  it('does NOT render FormWidget for a cards-rich template', () => {
    const wrapper = mountJson({
      templateId: 'cards-rich',
      header: { heading: 'Hello', description: 'World' },
      items: [],
    });
    expect(wrapper.find('[data-testid="form-widget-stub"]').exists()).toBe(false);
  });

  // W10: empty/unknown data does not render FormWidget.
  it('does NOT render FormWidget for empty/unknown data', () => {
    const wrapper = mountJson({});
    expect(wrapper.find('[data-testid="form-widget-stub"]').exists()).toBe(false);
  });

  // W10: data with fields but no sendFormToEmail does not pass isFormWidgetData guard.
  it('does NOT render FormWidget when sendFormToEmail is missing', () => {
    const wrapper = mountJson({
      fields: [{ label: 'Name', name: 'name', required: true, type: 'input' }],
    });
    expect(wrapper.find('[data-testid="form-widget-stub"]').exists()).toBe(false);
  });
});

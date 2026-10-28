// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';

import PortalDialogConfirmQuoteAction from '../../../app/components/portal/PortalDialogConfirmQuoteAction.vue';

const stubs = {
  Dialog: {
    props: ['open'],
    emits: ['update:open'],
    template: '<div v-if="open" data-testid="dialog-root"><slot /></div>',
  },
  DialogContent: {
    template: '<div :data-testid="$attrs[\'data-testid\']"><slot /></div>',
  },
  DialogHeader: { template: '<div><slot /></div>' },
  DialogTitle: { template: '<h2 data-testid="title"><slot /></h2>' },
  DialogDescription: { template: '<p data-testid="description"><slot /></p>' },
  DialogFooter: { template: '<div><slot /></div>' },
  Button: {
    props: ['disabled', 'variant'],
    emits: ['click'],
    template:
      '<button :data-testid="$attrs[\'data-testid\']" :data-variant="variant" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
};

function mount(props: Record<string, unknown> = {}) {
  return mountComponent(PortalDialogConfirmQuoteAction, {
    props: {
      open: true,
      title: 'Decline the quotation?',
      description: 'This cannot be undone.',
      confirmLabel: 'Decline',
      ...props,
    },
    global: { stubs },
  });
}

describe('PortalDialogConfirmQuoteAction', () => {
  it('renders nothing while closed', () => {
    const wrapper = mount({ open: false });

    expect(wrapper.find('[data-testid="quote-action-dialog"]').exists()).toBe(
      false,
    );
  });

  it('shows the title, the description and the confirm label', () => {
    const wrapper = mount();

    expect([
      wrapper.find('[data-testid="title"]').text(),
      wrapper.find('[data-testid="description"]').text(),
      wrapper.find('[data-testid="quote-action-confirm"]').text(),
    ]).toEqual(['Decline the quotation?', 'This cannot be undone.', 'Decline']);
  });

  it.each([
    [true, 'destructive'],
    [false, 'default'],
    [undefined, 'default'],
  ])('styles the confirm by destructive=%s', (destructive, variant) => {
    const wrapper = mount({ destructive });

    expect(
      wrapper
        .find('[data-testid="quote-action-confirm"]')
        .attributes('data-variant'),
    ).toBe(variant);
  });

  it('emits confirm, and nothing else, on the confirm button', async () => {
    const wrapper = mount();

    await wrapper.find('[data-testid="quote-action-confirm"]').trigger('click');

    expect(wrapper.emitted('confirm')).toHaveLength(1);
    expect(wrapper.emitted('update:open')).toBeUndefined();
  });

  it('asks to close, and does not confirm, on cancel', async () => {
    const wrapper = mount();

    await wrapper.find('[data-testid="quote-action-cancel"]').trigger('click');

    expect(wrapper.emitted('update:open')).toEqual([[false]]);
    expect(wrapper.emitted('confirm')).toBeUndefined();
  });

  it.each([
    [true, true],
    [false, false],
  ])('disables confirm while pending=%s', (pending, disabled) => {
    const wrapper = mount({ pending });

    expect(
      wrapper
        .find('[data-testid="quote-action-confirm"]')
        .attributes('disabled'),
    ).toBe(disabled ? '' : undefined);
  });
});

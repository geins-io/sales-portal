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
  Label: {
    props: ['for'],
    template: '<label :for="$props.for" data-testid="label"><slot /></label>',
  },
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

  describe('the message to the seller', () => {
    const field = (wrapper: ReturnType<typeof mount>) =>
      wrapper.find('[data-testid="quote-action-message"]');

    it('is an optional, labelled field with the placeholder it is given', () => {
      const wrapper = mount({
        message: '',
        messagePlaceholder: 'T.ex. vad som skulle behöva ändras …',
      });

      const label = wrapper.find('[data-testid="label"]');
      expect(label.text()).toBe('portal.quotations.answer_message');
      expect(label.attributes('for')).toBe(field(wrapper).attributes('id'));
      expect(field(wrapper).element.tagName).toBe('TEXTAREA');
      expect(field(wrapper).attributes('placeholder')).toBe(
        'T.ex. vad som skulle behöva ändras …',
      );
    });

    it('stops at 4000 characters and counts what is written', () => {
      const wrapper = mount({ message: 'Hej' });

      expect(field(wrapper).attributes('maxlength')).toBe('4000');
      expect(
        wrapper.find('[data-testid="quote-action-message-count"]').text(),
      ).toBe('3 / 4000');
      expect((field(wrapper).element as HTMLTextAreaElement).value).toBe('Hej');
    });

    it('emits what the buyer writes', async () => {
      const wrapper = mount({ message: '' });

      await field(wrapper).setValue('Vi har valt en annan lösning');

      expect(wrapper.emitted('update:message')).toEqual([
        ['Vi har valt en annan lösning'],
      ]);
      expect(wrapper.emitted('confirm')).toBeUndefined();
    });

    it.each([
      [true, true],
      [false, false],
    ])('is disabled while pending=%s', (pending, disabled) => {
      const wrapper = mount({ message: '', pending });

      expect(field(wrapper).attributes('disabled')).toBe(
        disabled ? '' : undefined,
      );
    });

    it('leaves confirm enabled when the field is empty', () => {
      const wrapper = mount({ message: '' });

      expect(
        wrapper
          .find('[data-testid="quote-action-confirm"]')
          .attributes('disabled'),
      ).toBeUndefined();
    });
  });
});

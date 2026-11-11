// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import PortalDialogDeleteQuoteDraft from '../../../app/components/portal/PortalDialogDeleteQuoteDraft.vue';

const stubs = {
  Dialog: {
    props: ['open'],
    template: '<div v-if="open"><slot /></div>',
  },
  DialogContent: { template: '<div><slot /></div>' },
  DialogHeader: { template: '<div><slot /></div>' },
  DialogTitle: { template: '<h2 data-testid="title"><slot /></h2>' },
  DialogDescription: { template: '<p data-testid="description"><slot /></p>' },
  DialogFooter: { template: '<div><slot /></div>' },
  Button: {
    props: ['disabled', 'variant'],
    emits: ['click'],
    template:
      '<button :data-testid="$attrs[\'data-testid\'] ?? variant" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
};

const mount = (props: Record<string, unknown> = {}) =>
  mountComponent(PortalDialogDeleteQuoteDraft, {
    props: { open: true, name: 'Kontor plan 3', ...props },
    global: { stubs },
  });

describe('PortalDialogDeleteQuoteDraft', () => {
  it('names the draft it deletes', () => {
    expect(mount().find('[data-testid="description"]').text()).toBe(
      'portal.quotations.delete_dialog.description',
    );
  });

  it('says what removing the last line does', () => {
    const wrapper = mount({ lastLine: true });

    expect(wrapper.find('[data-testid="title"]').text()).toBe(
      'portal.quotations.delete_dialog.last_line_title',
    );
    expect(wrapper.find('[data-testid="description"]').text()).toBe(
      'portal.quotations.delete_dialog.last_line_description',
    );
    expect(wrapper.find('[data-testid="delete-draft-confirm"]').text()).toBe(
      'portal.quotations.delete_dialog.submit',
    );
  });

  it('asks about the whole draft otherwise', () => {
    expect(mount().find('[data-testid="title"]').text()).toBe(
      'portal.quotations.delete_dialog.title',
    );
  });

  it('confirms, or closes on cancel', async () => {
    const wrapper = mount();

    await wrapper.find('[data-testid="delete-draft-confirm"]').trigger('click');
    await wrapper.find('[data-testid="outline"]').trigger('click');

    expect(wrapper.emitted('confirm')).toHaveLength(1);
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
  });

  it('cannot be confirmed twice while the delete runs', () => {
    expect(
      mount({ pending: true })
        .find('[data-testid="delete-draft-confirm"]')
        .attributes('disabled'),
    ).toBeDefined();
  });
});

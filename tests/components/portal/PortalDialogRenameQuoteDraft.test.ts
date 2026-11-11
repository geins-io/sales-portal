// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import PortalDialogRenameQuoteDraft from '../../../app/components/portal/PortalDialogRenameQuoteDraft.vue';
import { QUOTE_NAME_MAX_LENGTH } from '../../../shared/constants/quote';

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
};

const mount = (props: Record<string, unknown> = {}) =>
  mountComponent(PortalDialogRenameQuoteDraft, {
    props: { open: true, name: 'Kontor plan 3', ...props },
    global: { stubs },
  });

describe('PortalDialogRenameQuoteDraft', () => {
  it('opens with the draft name filled in', () => {
    const wrapper = mount();
    expect(wrapper.find('[data-testid="title"]').text()).toBe(
      'portal.quotations.rename_dialog.title',
    );
    expect(
      (
        wrapper.find('[data-testid="rename-draft-input"]')
          .element as HTMLInputElement
      ).value,
    ).toBe('Kontor plan 3');
  });

  it('submits the trimmed name', async () => {
    const wrapper = mount();
    await wrapper
      .find('[data-testid="rename-draft-input"]')
      .setValue('  Etapp 2  ');
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('submit')).toEqual([['Etapp 2']]);
  });

  it('asks for a name and submits nothing when it is blank', async () => {
    const wrapper = mount();
    await wrapper.find('[data-testid="rename-draft-input"]').setValue('   ');
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.find('[data-testid="rename-draft-error"]').text()).toBe(
      'portal.quotations.rename_dialog.required',
    );
  });

  it('caps the field at the name length Geins takes', () => {
    expect(
      mount()
        .find('[data-testid="rename-draft-input"]')
        .attributes('maxlength'),
    ).toBe(String(QUOTE_NAME_MAX_LENGTH));
  });

  it('closes without a submit on cancel', async () => {
    const wrapper = mount();
    await wrapper.find('[data-testid="rename-draft-cancel"]').trigger('click');
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('submits nothing while a save is running', async () => {
    const wrapper = mount({ pending: true });
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(
      wrapper.find('[data-testid="rename-draft-submit"]').attributes(),
    ).toHaveProperty('disabled');
  });

  it('fills in the current name again each time it opens', async () => {
    const wrapper = mount({ open: false });
    await wrapper.setProps({ open: true, name: 'Etapp 3' });
    expect(
      (
        wrapper.find('[data-testid="rename-draft-input"]')
          .element as HTMLInputElement
      ).value,
    ).toBe('Etapp 3');
  });
});

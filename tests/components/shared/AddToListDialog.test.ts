// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { mountComponent } from '../../utils/component';

import AddToListDialog from '../../../app/components/shared/AddToListDialog.vue';

const mockAddItemToList = vi.fn();
const mockRemoveItemFromList = vi.fn();
const mockCreateList = vi.fn();
const mockProductListIds = vi.fn((_productId: string): string[] => []);

const mockLists = ref<Array<{ id: string; name: string; items: string[] }>>([]);
const mockFavorites = ref<{ id: string; name: string; items: string[] } | null>(
  null,
);

vi.mock('../../../app/stores/favorites', () => ({
  useFavoritesStore: () => ({
    lists: mockLists.value,
    favorites: mockFavorites.value,
    addItemToList: mockAddItemToList,
    removeItemFromList: mockRemoveItemFromList,
    createList: mockCreateList,
    productListIds: mockProductListIds,
  }),
}));

const stubs = {
  Dialog: {
    props: ['open'],
    emits: ['update:open'],
    template: '<div v-if="open" data-testid="dialog-root"><slot /></div>',
  },
  DialogContent: {
    template: '<div data-testid="dialog-content"><slot /></div>',
  },
  DialogHeader: { template: '<div><slot /></div>' },
  DialogTitle: { template: '<h2><slot /></h2>' },
  DialogFooter: { template: '<div><slot /></div>' },
  Button: {
    props: ['disabled', 'variant', 'size', 'type'],
    template:
      '<button :data-testid="$attrs[\'data-testid\']" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  Input: {
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue'],
    template:
      '<input :id="$attrs.id" :data-testid="$attrs[\'data-testid\']" :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  Checkbox: {
    props: ['modelValue', 'id'],
    emits: ['update:modelValue'],
    template:
      '<input type="checkbox" :id="id" :checked="modelValue" :data-testid="$attrs[\'data-testid\']" :aria-label="$attrs[\'aria-label\']" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
  },
  Icon: { props: ['name'], template: '<span></span>' },
  NuxtIcon: { props: ['name'], template: '<span></span>' },
};

function mount(opts: { open?: boolean; productAlias?: string } = {}) {
  return mountComponent(AddToListDialog, {
    props: {
      open: opts.open ?? true,
      productAlias: opts.productAlias ?? 'test-product',
    },
    global: { stubs },
  });
}

describe('AddToListDialog', () => {
  beforeEach(() => {
    mockLists.value = [];
    mockFavorites.value = {
      id: '__favorites__',
      name: 'Favorites',
      items: [],
    };
    mockAddItemToList.mockClear();
    mockRemoveItemFromList.mockClear();
    mockCreateList.mockClear();
    mockProductListIds.mockReset();
    mockProductListIds.mockImplementation(() => []);
  });

  it('does not render when open is false', () => {
    const wrapper = mount({ open: false });
    expect(wrapper.find('[data-testid="dialog-content"]').exists()).toBe(false);
  });

  it('renders the favorites row as the first option', () => {
    const wrapper = mount({ open: true });
    const rows = wrapper.findAll('[data-testid="add-to-list-row"]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.attributes('data-list-id')).toBe('__favorites__');
  });

  it('renders a row for every custom list plus favorites', () => {
    mockLists.value = [
      { id: 'l1', name: 'Kitchen', items: [] },
      { id: 'l2', name: 'Bathroom', items: ['test-product'] },
    ];
    const wrapper = mount({ open: true });
    const rows = wrapper.findAll('[data-testid="add-to-list-row"]');
    expect(rows).toHaveLength(3); // favorites + 2 custom
    expect(rows.map((r) => r.attributes('data-list-id'))).toEqual([
      '__favorites__',
      'l1',
      'l2',
    ]);
  });

  it('marks the checkbox as checked for lists that already contain the product', () => {
    mockLists.value = [{ id: 'l1', name: 'Kitchen', items: ['test-product'] }];
    mockProductListIds.mockImplementation((id) =>
      id === 'test-product' ? ['l1'] : [],
    );

    const wrapper = mount({ open: true });
    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    expect(checkboxes[0]!.element.checked).toBe(false); // favorites
    expect(checkboxes[1]!.element.checked).toBe(true); // l1
  });

  it('calls addItemToList when an unchecked list is toggled on', async () => {
    mockLists.value = [{ id: 'l1', name: 'Kitchen', items: [] }];
    const wrapper = mount({ open: true, productAlias: 'widget' });
    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    const l1Checkbox = checkboxes[1]!;
    await l1Checkbox.setValue(true);
    expect(mockAddItemToList).toHaveBeenCalledWith('l1', 'widget');
  });

  it('calls removeItemFromList when a checked list is toggled off', async () => {
    mockLists.value = [{ id: 'l1', name: 'Kitchen', items: ['widget'] }];
    mockProductListIds.mockImplementation(() => ['l1']);
    const wrapper = mount({ open: true, productAlias: 'widget' });
    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    const l1Checkbox = checkboxes[1]!;
    await l1Checkbox.setValue(false);
    expect(mockRemoveItemFromList).toHaveBeenCalledWith('l1', 'widget');
  });

  it('reveals the create form when the trigger is clicked', async () => {
    const wrapper = mount({ open: true });
    expect(
      wrapper.find('[data-testid="add-to-list-create-form"]').exists(),
    ).toBe(false);
    await wrapper
      .find('[data-testid="add-to-list-create-trigger"]')
      .trigger('click');
    expect(
      wrapper.find('[data-testid="add-to-list-create-form"]').exists(),
    ).toBe(true);
  });

  it('creates a new list and auto-adds the product when the form is submitted', async () => {
    mockCreateList.mockImplementation((name: string) => ({
      id: 'new-id',
      name,
      items: [],
      createdAt: 0,
      updatedAt: 0,
    }));

    const wrapper = mount({ open: true, productAlias: 'widget' });
    await wrapper
      .find('[data-testid="add-to-list-create-trigger"]')
      .trigger('click');
    await wrapper
      .find('[data-testid="add-to-list-new-name"]')
      .setValue('Upstairs bathroom');
    await wrapper
      .find('[data-testid="add-to-list-create-form"]')
      .trigger('submit');

    expect(mockCreateList).toHaveBeenCalledWith('Upstairs bathroom');
    expect(mockAddItemToList).toHaveBeenCalledWith('new-id', 'widget');
  });

  it('disables create submit when the list name is empty or whitespace', async () => {
    const wrapper = mount({ open: true });
    await wrapper
      .find('[data-testid="add-to-list-create-trigger"]')
      .trigger('click');

    const submit = wrapper.find('[data-testid="add-to-list-create-submit"]');
    expect(submit.attributes('disabled')).toBeDefined();

    await wrapper.find('[data-testid="add-to-list-new-name"]').setValue('   ');
    expect(submit.attributes('disabled')).toBeDefined();

    await wrapper.find('[data-testid="add-to-list-new-name"]').setValue('OK');
    expect(submit.attributes('disabled')).toBeUndefined();
  });

  it('emits update:open(false) when the done button is clicked', async () => {
    const wrapper = mount({ open: true });
    await wrapper.find('[data-testid="add-to-list-done"]').trigger('click');
    const emitted = wrapper.emitted('update:open');
    expect(emitted?.at(-1)).toEqual([false]);
  });

  it('hides the create form again when dialog is closed and reopened', async () => {
    const wrapper = mount({ open: true });
    await wrapper
      .find('[data-testid="add-to-list-create-trigger"]')
      .trigger('click');
    expect(
      wrapper.find('[data-testid="add-to-list-create-form"]').exists(),
    ).toBe(true);
    // cancel returns us to the trigger state
    await wrapper
      .find('[data-testid="add-to-list-create-cancel"]')
      .trigger('click');
    expect(
      wrapper.find('[data-testid="add-to-list-create-form"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="add-to-list-create-trigger"]').exists(),
    ).toBe(true);
  });
});

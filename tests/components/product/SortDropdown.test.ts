import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import SortDropdown from '../../../app/components/product/SortDropdown.vue';

// Stub the reka-ui Select primitives so we can assert the props/classes
// SortDropdown forwards. ClientOnly is already stubbed in mountComponent.
const selectStubs = {
  Select: { template: '<div><slot /></div>', props: ['modelValue'] },
  SelectTrigger: {
    template: '<button data-testid="sort-trigger"><slot /></button>',
    props: ['size'],
  },
  SelectValue: { template: '<span><slot /></span>', props: ['placeholder'] },
  SelectContent: {
    template: '<div data-testid="sort-content"><slot /></div>',
    props: ['bodyLock'],
  },
  SelectItem: {
    template: '<div class="sort-item"><slot /></div>',
    props: ['value'],
  },
};

const options = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Newest', value: 'newest' },
];

function mountSort() {
  return mountComponent(SortDropdown, {
    props: { modelValue: 'relevance', options },
    global: { stubs: selectStubs },
  });
}

describe('SortDropdown mobile adjustments', () => {
  it('disables body lock so opening the dropdown does not shift the page', () => {
    const content = mountSort().findComponent('[data-testid="sort-content"]');
    expect(content.props('bodyLock')).toBe(false);
  });

  it('makes the dropdown full width on mobile', () => {
    const content = mountSort().find('[data-testid="sort-content"]');
    expect(content.classes()).toContain('w-screen');
  });

  it('adds py-3 touch padding to each option on mobile', () => {
    const items = mountSort().findAll('.sort-item');
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.classes()).toContain('py-3');
    }
  });
});

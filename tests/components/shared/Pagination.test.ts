import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Pagination from '../../../app/components/shared/NumberedPagination.vue';

const ChevronLeftStub = { template: '<span class="chevron-left" />' };
const ChevronRightStub = { template: '<span class="chevron-right" />' };

const i18nMock = {
  mocks: {
    $t: (key: string) => {
      const translations: Record<string, string> = {
        'pagination.previous': 'Previous',
        'pagination.next': 'Next',
        'pagination.navigation': 'Pagination',
      };
      return translations[key] ?? key;
    },
  },
};

function mountPagination(props: { currentPage: number; totalPages: number }) {
  return mount(Pagination, {
    props,
    global: {
      stubs: { ChevronLeft: ChevronLeftStub, ChevronRight: ChevronRightStub },
      ...i18nMock,
    },
  });
}

describe('Pagination', () => {
  it('does not render when totalPages is 1', () => {
    const wrapper = mountPagination({ currentPage: 1, totalPages: 1 });
    expect(wrapper.find('nav').exists()).toBe(false);
  });

  it('renders all page numbers for small page counts', () => {
    const wrapper = mountPagination({ currentPage: 1, totalPages: 5 });
    const buttons = wrapper.findAll('button');
    // Previous + 5 pages + Next = 7 buttons
    expect(buttons).toHaveLength(7);
    expect(buttons[1].text()).toBe('1');
    expect(buttons[5].text()).toBe('5');
  });

  it('highlights the current page', () => {
    const wrapper = mountPagination({ currentPage: 3, totalPages: 5 });
    const buttons = wrapper.findAll('button');
    // Page 3 is the 4th button (after Previous)
    expect(buttons[3].classes()).toContain('bg-primary');
    expect(buttons[3].attributes('aria-current')).toBe('page');
  });

  it('disables Previous button on first page', () => {
    const wrapper = mountPagination({ currentPage: 1, totalPages: 5 });
    const prevButton = wrapper.findAll('button')[0];
    expect(prevButton.attributes('disabled')).toBeDefined();
  });

  it('disables Next button on last page', () => {
    const wrapper = mountPagination({ currentPage: 5, totalPages: 5 });
    const buttons = wrapper.findAll('button');
    const nextButton = buttons[buttons.length - 1];
    expect(nextButton.attributes('disabled')).toBeDefined();
  });

  it('emits update:currentPage when a page button is clicked', async () => {
    const wrapper = mountPagination({ currentPage: 1, totalPages: 5 });
    // Click page 3 (index 3: Previous, 1, 2, 3)
    await wrapper.findAll('button')[3].trigger('click');
    expect(wrapper.emitted('update:currentPage')).toBeTruthy();
    expect(wrapper.emitted('update:currentPage')![0]).toEqual([3]);
  });

  it('emits update:currentPage when Next is clicked', async () => {
    const wrapper = mountPagination({ currentPage: 2, totalPages: 5 });
    const buttons = wrapper.findAll('button');
    await buttons[buttons.length - 1].trigger('click');
    expect(wrapper.emitted('update:currentPage')![0]).toEqual([3]);
  });

  it('emits update:currentPage when Previous is clicked', async () => {
    const wrapper = mountPagination({ currentPage: 3, totalPages: 5 });
    await wrapper.findAll('button')[0].trigger('click');
    expect(wrapper.emitted('update:currentPage')![0]).toEqual([2]);
  });

  it('shows ellipsis for many pages', () => {
    const wrapper = mountPagination({ currentPage: 5, totalPages: 10 });
    const text = wrapper.text();
    // Should contain ellipsis characters
    expect(text).toContain('\u2026');
  });

  it('does not emit when clicking the current page', async () => {
    const wrapper = mountPagination({ currentPage: 3, totalPages: 5 });
    // Click page 3 (current page)
    await wrapper.findAll('button')[3].trigger('click');
    expect(wrapper.emitted('update:currentPage')).toBeFalsy();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { mountComponent } from '../utils/component';
import ErrorBoundary from '../../app/components/shared/ErrorBoundary.vue';
import * as ErrorTracking from '../../app/composables/useErrorTracking';

// Mock the useErrorBoundary composable so we control error/clearError in tests
const mockError = ref<Error | null>(null);
const mockClearError = vi.fn(() => {
  mockError.value = null;
});

vi.mock('../../app/composables/useErrorTracking', () => ({
  useErrorBoundary: vi.fn(() => ({
    error: mockError,
    clearError: mockClearError,
  })),
  useErrorTracking: vi.fn(() => ({
    trackError: vi.fn(),
  })),
}));

describe('ErrorBoundary', () => {
  beforeEach(() => {
    mockError.value = null;
    mockClearError.mockClear();
  });

  describe('slot rendering', () => {
    it('renders slot content when there is no error', () => {
      const wrapper = mountComponent(ErrorBoundary, {
        slots: { default: '<p class="slot-content">Hello</p>' },
      });

      expect(wrapper.find('.slot-content').exists()).toBe(true);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    });

    it('does not render the alert when error is null', () => {
      const wrapper = mountComponent(ErrorBoundary);

      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    });
  });

  describe('error fallback', () => {
    it('shows the fallback alert when error ref is set', async () => {
      const wrapper = mountComponent(ErrorBoundary, {
        slots: { default: '<p>Slot</p>' },
      });

      mockError.value = new Error('boom');
      await wrapper.vm.$nextTick();

      expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      expect(wrapper.find('.slot-content').exists()).toBe(false);
    });

    it('displays the section_failed i18n key in the fallback', async () => {
      const wrapper = mountComponent(ErrorBoundary);

      mockError.value = new Error('boom');
      await wrapper.vm.$nextTick();

      expect(wrapper.find('[role="alert"]').text()).toContain(
        'errors.section_failed',
      );
    });

    it('hides slot content while error is active', async () => {
      const wrapper = mountComponent(ErrorBoundary, {
        slots: { default: '<span class="child">child</span>' },
      });

      mockError.value = new Error('fail');
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.child').exists()).toBe(false);
    });

    it('renders a provided fallback slot instead of the default alert', async () => {
      const wrapper = mountComponent(ErrorBoundary, {
        slots: {
          default: '<span class="child">child</span>',
          fallback: '<p class="custom-fallback">degraded</p>',
        },
      });

      mockError.value = new Error('boom');
      await wrapper.vm.$nextTick();

      // Custom fallback wins; the scary section-failed band is suppressed.
      expect(wrapper.find('.custom-fallback').exists()).toBe(true);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.find('.child').exists()).toBe(false);
    });

    it('renders nothing on error when the silent prop is set', async () => {
      const wrapper = mountComponent(ErrorBoundary, {
        props: { silent: true },
        slots: { default: '<span class="child">child</span>' },
      });

      mockError.value = new Error('boom');
      await wrapper.vm.$nextTick();

      // No band, no child: the failed subtree degrades silently.
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.find('.child').exists()).toBe(false);
    });

    it('still shows the default band on error when not silent and no fallback', async () => {
      const wrapper = mountComponent(ErrorBoundary, {
        slots: { default: '<span class="child">child</span>' },
      });

      mockError.value = new Error('boom');
      await wrapper.vm.$nextTick();

      expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    });
  });

  describe('retry button', () => {
    it('renders a retry button in the fallback', async () => {
      const wrapper = mountComponent(ErrorBoundary);

      mockError.value = new Error('boom');
      await wrapper.vm.$nextTick();

      const btn = wrapper.find('button');
      expect(btn.exists()).toBe(true);
      expect(btn.text()).toContain('errors.retry');
    });

    it('calls clearError when retry button is clicked', async () => {
      const wrapper = mountComponent(ErrorBoundary);

      mockError.value = new Error('boom');
      await wrapper.vm.$nextTick();

      await wrapper.find('button').trigger('click');

      expect(mockClearError).toHaveBeenCalledTimes(1);
    });

    it('hides the fallback after clearError resets the error', async () => {
      const wrapper = mountComponent(ErrorBoundary, {
        slots: { default: '<p class="back">Back</p>' },
      });

      mockError.value = new Error('boom');
      await wrapper.vm.$nextTick();

      expect(wrapper.find('[role="alert"]').exists()).toBe(true);

      await wrapper.find('button').trigger('click');
      await wrapper.vm.$nextTick();

      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.find('.back').exists()).toBe(true);
    });
  });

  describe('section prop', () => {
    it('uses "section" as the default section value', () => {
      const spy = vi.spyOn(ErrorTracking, 'useErrorBoundary');

      mountComponent(ErrorBoundary);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ component: 'ErrorBoundary:section' }),
      );
    });

    it('passes the section prop into the component context', () => {
      const spy = vi.spyOn(ErrorTracking, 'useErrorBoundary');

      mountComponent(ErrorBoundary, { props: { section: 'header' } });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ component: 'ErrorBoundary:header' }),
      );
    });
  });
});

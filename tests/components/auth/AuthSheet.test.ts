import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { shallowMountComponent } from '../../utils/component';
import AuthSheet from '../../../app/components/auth/AuthSheet.vue';

// useAuthStore mock — plain object so template property access (authStore.sheetView)
// returns primitive values directly, matching how Pinia exposes store state.
const authStoreState = {
  sheetOpen: true,
  sheetView: 'login' as 'login' | 'forgot',
  isAuthenticated: false,
  closeSheet: vi.fn(),
  clearError: vi.fn(),
};

vi.mock('../../../app/stores/auth', () => ({
  useAuthStore: () => authStoreState,
}));

// useTenant mock — default: applyForAccount feature enabled
const mockHasFeature = vi.fn(
  (feature: string) => feature === 'applyForAccount',
);
vi.mock('../../../app/composables/useTenant', () => ({
  useTenant: () => ({ hasFeature: mockHasFeature }),
}));

// useCmsPageLink mock — default: apply page resolved
const mockApplyTo = ref<string | undefined>('/se/sv/ansok-om-konto');
const mockApplyResolved = ref(true);
vi.mock('../../../app/composables/useCmsPageLink', () => ({
  useCmsPageLink: () => ({
    to: mockApplyTo,
    isResolved: mockApplyResolved,
  }),
}));

// Stub Sheet UI primitives so slot content renders in JSDOM
const stubs = {
  Sheet: { template: '<div><slot /></div>', props: ['open'] },
  SheetContent: { template: '<div><slot /></div>', props: ['side'] },
  SheetHeader: { template: '<div><slot /></div>' },
  SheetTitle: { template: '<div><slot /></div>' },
  SheetDescription: { template: '<div><slot /></div>' },
  Separator: { template: '<hr />' },
  Button: {
    template:
      '<button :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot /></button>',
    props: ['variant'],
  },
  LoginForm: { template: '<div data-testid="login-form-stub" />' },
  ForgotPasswordForm: { template: '<div data-testid="forgot-form-stub" />' },
};

describe('AuthSheet', () => {
  beforeEach(() => {
    authStoreState.sheetOpen = true;
    authStoreState.sheetView = 'login';
    authStoreState.closeSheet.mockReset();
    mockApplyTo.value = '/se/sv/ansok-om-konto';
    mockApplyResolved.value = true;
    mockHasFeature.mockImplementation(
      (feature: string) => feature === 'applyForAccount',
    );
  });

  function mountAuthSheet() {
    return shallowMountComponent(AuthSheet, {
      global: { stubs },
    });
  }

  it('renders the auth sheet wrapper', () => {
    const wrapper = mountAuthSheet();
    expect(wrapper.find('[data-testid="auth-sheet"]').exists()).toBe(true);
  });

  describe('apply for account link', () => {
    it('shows apply link when feature enabled and apply page resolved', () => {
      const wrapper = mountAuthSheet();
      expect(wrapper.find('[data-testid="auth-sheet-apply"]').exists()).toBe(
        true,
      );
    });

    it('apply link href matches the tag-resolved path', () => {
      const wrapper = mountAuthSheet();
      const applyLink = wrapper.find('[data-testid="auth-sheet-apply"]');
      expect(applyLink.exists()).toBe(true);
      expect(applyLink.attributes('href')).toBe('/se/sv/ansok-om-konto');
    });

    it('hides apply link when apply page is unresolved', () => {
      mockApplyTo.value = undefined;
      mockApplyResolved.value = false;
      const wrapper = mountAuthSheet();
      expect(wrapper.find('[data-testid="auth-sheet-apply"]').exists()).toBe(
        false,
      );
    });

    it('hides apply link when applyForAccount feature is disabled', () => {
      mockHasFeature.mockImplementation(() => false);
      const wrapper = mountAuthSheet();
      expect(wrapper.find('[data-testid="auth-sheet-apply"]').exists()).toBe(
        false,
      );
    });

    it('clicking apply link closes the sheet', async () => {
      const wrapper = mountAuthSheet();
      await wrapper.find('[data-testid="auth-sheet-apply"]').trigger('click');
      expect(authStoreState.closeSheet).toHaveBeenCalled();
    });
  });
});

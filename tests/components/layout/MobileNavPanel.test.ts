import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import MobileNavPanel from '../../../app/components/layout/MobileNavPanel.vue';

// Mock the app store
const mockAppStore = {
  sidebarOpen: false,
  setSidebarOpen: vi.fn(),
  toggleSidebar: vi.fn(),
};

vi.mock('~/stores/app', () => ({
  useAppStore: () => mockAppStore,
}));

// Mock auth store
vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: false,
    displayName: '',
  }),
}));

// Stub shadcn-vue primitives so they render their slots.
// Include both original and Nuxt-prefixed names (Nuxt resolves ui/sheet → UiSheet).
const slotDiv = { template: '<div><slot /></div>' };
const sheetStubs = {
  Sheet: { template: '<div><slot /></div>', props: ['open'] },
  SheetContent: { template: '<div><slot /></div>', props: ['side'] },
  Accordion: { template: '<div><slot /></div>', props: ['type'] },
  AccordionItem: { template: '<div><slot /></div>', props: ['value'] },
  AccordionTrigger: { template: '<button><slot /></button>' },
  AccordionContent: slotDiv,
  UiSheet: { template: '<div><slot /></div>', props: ['open'] },
  UiSheetContent: { template: '<div><slot /></div>', props: ['side'] },
  UiAccordion: { template: '<div><slot /></div>', props: ['type'] },
  UiAccordionItem: { template: '<div><slot /></div>', props: ['value'] },
  UiAccordionTrigger: { template: '<button><slot /></button>' },
  UiAccordionContent: slotDiv,
  User: { template: '<span />' },
};

describe('MobileNavPanel', () => {
  const mountOptions = {
    global: {
      stubs: sheetStubs,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAppStore.sidebarOpen = false;
  });

  it('renders with data-slot="mobile-nav"', () => {
    const wrapper = shallowMountComponent(MobileNavPanel, mountOptions);
    expect(wrapper.find('[data-slot="mobile-nav"]').exists()).toBe(true);
  });

  it('contains a brand logo', () => {
    mockAppStore.sidebarOpen = true;
    const wrapper = shallowMountComponent(MobileNavPanel, mountOptions);
    expect(wrapper.find('brand-logo-stub').exists()).toBe(true);
  });

  it('renders navigation menu items', () => {
    mockAppStore.sidebarOpen = true;
    const wrapper = shallowMountComponent(MobileNavPanel, mountOptions);
    expect(wrapper.text()).toContain('Product category');
  });

  it('renders login link', () => {
    mockAppStore.sidebarOpen = true;
    const wrapper = shallowMountComponent(MobileNavPanel, mountOptions);
    expect(wrapper.text()).toContain('auth.login');
  });
});

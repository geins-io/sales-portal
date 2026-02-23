import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { shallowMountComponent } from '../../utils/component';
import MobileNavPanel from '../../../app/components/layout/MobileNavPanel.vue';
import type { MenuType } from '@geins/types';

const mockMenu = ref<MenuType | null>(null);
vi.mock('~/composables/useMenuData', () => ({
  useMenuData: () => ({
    menu: mockMenu,
    pending: ref(false),
    error: ref(null),
  }),
}));

vi.stubGlobal('useRequestURL', () => new URL('https://test.example.com'));

const mockAppStore = {
  sidebarOpen: false,
  setSidebarOpen: vi.fn(),
  toggleSidebar: vi.fn(),
};
vi.mock('~/stores/app', () => ({
  useAppStore: () => mockAppStore,
}));

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: false,
    displayName: '',
  }),
}));

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
  const mountOptions = { global: { stubs: sheetStubs } };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAppStore.sidebarOpen = true;
  });

  it('renders with data-slot="mobile-nav"', () => {
    mockMenu.value = null;
    const wrapper = shallowMountComponent(MobileNavPanel, mountOptions);
    expect(wrapper.find('[data-slot="mobile-nav"]').exists()).toBe(true);
  });

  it('renders CMS menu items', () => {
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [
        { id: '1', label: 'Epoxi', canonicalUrl: '/epoxi', order: 1 },
        { id: '2', label: 'Fixturer', canonicalUrl: '/fixturer', order: 2 },
      ],
    };
    const wrapper = shallowMountComponent(MobileNavPanel, mountOptions);
    expect(wrapper.text()).toContain('Epoxi');
    expect(wrapper.text()).toContain('Fixturer');
  });

  it('renders children in accordion', () => {
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [
        {
          id: '1',
          label: 'Category',
          order: 1,
          children: [
            { id: '1-1', label: 'Sub A', canonicalUrl: '/sub-a', order: 1 },
          ],
        },
      ],
    };
    const wrapper = shallowMountComponent(MobileNavPanel, mountOptions);
    expect(wrapper.text()).toContain('Category');
    expect(wrapper.text()).toContain('Sub A');
  });

  it('filters hidden items', () => {
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [
        { id: '1', label: 'Visible', order: 1 },
        { id: '2', label: 'Hidden', hidden: true, order: 2 },
      ],
    };
    const wrapper = shallowMountComponent(MobileNavPanel, mountOptions);
    expect(wrapper.text()).toContain('Visible');
    expect(wrapper.text()).not.toContain('Hidden');
  });

  it('renders login link when not authenticated', () => {
    mockMenu.value = { id: '1', title: 'Main', menuItems: [] };
    const wrapper = shallowMountComponent(MobileNavPanel, mountOptions);
    expect(wrapper.text()).toContain('auth.login');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, type Ref } from 'vue';
import { mountComponent } from '../../utils/component';
import PageSidebarNav from '../../../app/components/pages/PageSidebarNav.vue';
import type { MenuType } from '@geins/types';

// --- Mocks ---

// vi.hoisted runs before vi.mock hoisting, so these are available in mock factories
const { mockRoutePath } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref: hoistedRef } = require('vue') as { ref: <T>(v: T) => Ref<T> };
  return { mockRoutePath: hoistedRef('/') };
});

vi.mock('#app/composables/router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref: mockRef } = require('vue') as { ref: <T>(v: T) => Ref<T> };
  return {
    useRoute: () => ({
      path: mockRoutePath.value,
      params: {},
      query: {},
      hash: '',
      fullPath: mockRoutePath.value,
      name: 'page',
      matched: [],
      redirectedFrom: undefined,
      meta: {},
    }),
    useRouter: () => ({
      push: vi.fn(() => Promise.resolve()),
      replace: vi.fn(() => Promise.resolve()),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      currentRoute: mockRef({
        path: mockRoutePath.value,
        params: {},
        query: {},
        hash: '',
        fullPath: mockRoutePath.value,
        name: 'page',
        matched: [],
        redirectedFrom: undefined,
        meta: {},
      }),
    }),
  };
});

const mockMenu = ref<MenuType | null>(null);
const mockPending = ref(false);
const mockError = ref<Error | null>(null);

vi.mock('~/composables/useMenuData', () => ({
  useMenuData: () => ({
    menu: mockMenu,
    pending: mockPending,
    error: mockError,
  }),
}));

vi.stubGlobal('useRequestURL', () => new URL('https://test.example.com'));

const slotDiv = { template: '<div><slot /></div>' };
const stubs = {
  Accordion: {
    template: '<div data-stub="accordion"><slot /></div>',
    props: ['type', 'collapsible'],
  },
  AccordionItem: {
    template: '<div data-stub="accordion-item"><slot /></div>',
    props: ['value'],
  },
  AccordionTrigger: {
    template: '<button data-stub="accordion-trigger"><slot /></button>',
  },
  AccordionContent: slotDiv,
  UiAccordion: {
    template: '<div data-stub="accordion"><slot /></div>',
    props: ['type', 'collapsible'],
  },
  UiAccordionItem: {
    template: '<div data-stub="accordion-item"><slot /></div>',
    props: ['value'],
  },
  UiAccordionTrigger: {
    template: '<button data-stub="accordion-trigger"><slot /></button>',
  },
  UiAccordionContent: slotDiv,
};

describe('PageSidebarNav', () => {
  beforeEach(() => {
    mockMenu.value = null;
    mockPending.value = false;
    mockError.value = null;
    mockRoutePath.value = '/';
  });

  it('renders nothing when menu is loading', () => {
    mockPending.value = true;
    const wrapper = mountComponent(PageSidebarNav, {
      props: { menuLocationId: 'sidebar' },
      global: { stubs },
    });
    expect(wrapper.html()).toBe('<!--v-if-->');
  });

  it('renders nothing when menu fetch fails', () => {
    mockError.value = new Error('fetch failed');
    const wrapper = mountComponent(PageSidebarNav, {
      props: { menuLocationId: 'sidebar' },
      global: { stubs },
    });
    expect(wrapper.html()).toBe('<!--v-if-->');
  });

  it('renders nothing when menu has no items', () => {
    mockMenu.value = { id: '1', title: 'Sidebar', menuItems: [] };
    const wrapper = mountComponent(PageSidebarNav, {
      props: { menuLocationId: 'sidebar' },
      global: { stubs },
    });
    expect(wrapper.html()).toBe('<!--v-if-->');
  });

  it('has correct data-testid and aria-label on nav', () => {
    mockMenu.value = {
      id: '1',
      title: 'Sidebar',
      menuItems: [
        { id: '1', label: 'About', canonicalUrl: '/se/sv/about', order: 1 },
      ],
    };
    const wrapper = mountComponent(PageSidebarNav, {
      props: { menuLocationId: 'sidebar' },
      global: { stubs },
    });
    const nav = wrapper.find('[data-testid="sidebar-nav"]');
    expect(nav.exists()).toBe(true);
    expect(nav.attributes('aria-label')).toBe('nav.sidebar_navigation');
  });

  it('renders visible menu items and filters hidden ones', () => {
    mockMenu.value = {
      id: '1',
      title: 'Sidebar',
      menuItems: [
        {
          id: '1',
          label: 'About Us',
          canonicalUrl: '/se/sv/about-us',
          order: 1,
        },
        {
          id: '2',
          label: 'Hidden Page',
          canonicalUrl: '/se/sv/hidden',
          order: 2,
          hidden: true,
        },
        { id: '3', label: 'Contact', canonicalUrl: '/se/sv/contact', order: 3 },
      ],
    };
    const wrapper = mountComponent(PageSidebarNav, {
      props: { menuLocationId: 'sidebar' },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('About Us');
    expect(wrapper.text()).toContain('Contact');
    expect(wrapper.text()).not.toContain('Hidden Page');
  });

  it('highlights the active menu item matching the current route', () => {
    mockRoutePath.value = '/about-us';
    mockMenu.value = {
      id: '1',
      title: 'Sidebar',
      menuItems: [
        {
          id: '1',
          label: 'About Us',
          canonicalUrl: '/se/sv/about-us',
          order: 1,
        },
        { id: '2', label: 'Contact', canonicalUrl: '/se/sv/contact', order: 2 },
      ],
    };
    const wrapper = mountComponent(PageSidebarNav, {
      props: { menuLocationId: 'sidebar' },
      global: { stubs },
    });
    // The active link should have an aria-current attribute
    const links = wrapper.findAll('a');
    const activeLink = links.find(
      (l) => l.attributes('aria-current') === 'page',
    );
    expect(activeLink).toBeTruthy();
    expect(activeLink!.text()).toBe('About Us');
    // The other link should not have aria-current
    const contactLink = links.find((l) => l.text() === 'Contact');
    expect(contactLink?.attributes('aria-current')).toBeUndefined();
  });

  it('renders children as nested items (2-level nesting)', () => {
    mockMenu.value = {
      id: '1',
      title: 'Sidebar',
      menuItems: [
        {
          id: '1',
          label: 'Products',
          canonicalUrl: '/se/sv/products',
          order: 1,
          children: [
            {
              id: '1-1',
              label: 'Epoxi',
              canonicalUrl: '/se/sv/epoxi',
              order: 1,
            },
            {
              id: '1-2',
              label: 'Fixturer',
              canonicalUrl: '/se/sv/fixturer',
              order: 2,
            },
            {
              id: '1-3',
              label: 'Secret',
              canonicalUrl: '/se/sv/secret',
              order: 3,
              hidden: true,
            },
          ],
        },
      ],
    };
    const wrapper = mountComponent(PageSidebarNav, {
      props: { menuLocationId: 'sidebar' },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Products');
    expect(wrapper.text()).toContain('Epoxi');
    expect(wrapper.text()).toContain('Fixturer');
    expect(wrapper.text()).not.toContain('Secret');
  });
});

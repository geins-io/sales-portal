import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed, type Ref } from 'vue';
import { mountComponent } from '../../utils/component';
import InfoPageSidebar from '../../../app/components/pages/InfoPageSidebar.vue';
import type { MenuType } from '@geins/types';

// --- Hoisted mocks ---

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

// CMS menu mock state
const mockMenu = ref<MenuType | null>(null);
const mockPending = ref(false);
const mockError = ref<Error | null>(null);
const mockIsConfigured = ref(false);

vi.mock('../../../app/composables/useCmsMenuData', () => ({
  useCmsMenuData: () => ({
    menu: mockMenu,
    pending: mockPending,
    error: mockError,
    isConfigured: mockIsConfigured,
  }),
}));

// localePath returns a deterministic prefix
let mockLocalePathFn = (path: string) => `/se/sv${path}`;

vi.mock('../../../app/composables/useLocaleMarket', () => ({
  useLocaleMarket: () => ({
    localePath: (path: string) => mockLocalePathFn(path),
    currentMarket: ref('se'),
    currentLocale: ref('sv'),
    localeQuery: computed(() => ({ locale: 'sv', market: 'se' })),
  }),
}));

vi.stubGlobal('useRequestURL', () => new URL('https://test.example.com'));

describe('InfoPageSidebar', () => {
  beforeEach(() => {
    mockMenu.value = null;
    mockPending.value = false;
    mockError.value = null;
    mockIsConfigured.value = false;
    mockRoutePath.value = '/';
    mockLocalePathFn = (path: string) => `/se/sv${path}`;
  });

  // --- Fallback branch ---

  it('renders fallback links when menu is unconfigured', () => {
    mockIsConfigured.value = false;
    const wrapper = mountComponent(InfoPageSidebar, {
      props: { activePath: '/about' },
    });
    const anchors = wrapper.findAll('a');
    expect(anchors.length).toBe(4);
    const hrefs = anchors.map((a) => a.attributes('href'));
    expect(hrefs).toContain('/se/sv/about');
    expect(hrefs).toContain('/se/sv/contact');
    expect(hrefs).toContain('/se/sv/apply-for-account');
    expect(hrefs).toContain('/se/sv/terms');
  });

  it('renders fallback links with layout.* label keys (no raw info_pages.)', () => {
    mockIsConfigured.value = false;
    const wrapper = mountComponent(InfoPageSidebar, {
      props: { activePath: '/about' },
    });
    const text = wrapper.text();
    expect(text).not.toContain('info_pages.');
    expect(text).toContain('layout.about_us');
    expect(text).toContain('layout.contact');
    expect(text).toContain('layout.apply_for_account');
    expect(text).toContain('layout.terms');
  });

  it('falls back when menu is configured but empty', () => {
    mockIsConfigured.value = true;
    mockMenu.value = { id: '1', title: 'Info', menuItems: [] };
    const wrapper = mountComponent(InfoPageSidebar, {
      props: { activePath: '/about' },
    });
    const anchors = wrapper.findAll('a');
    expect(anchors.length).toBe(4);
    const hrefs = anchors.map((a) => a.attributes('href'));
    expect(hrefs).toContain('/se/sv/about');
  });

  it('falls back when errored', () => {
    mockIsConfigured.value = true;
    mockError.value = new Error('network error');
    const wrapper = mountComponent(InfoPageSidebar, {
      props: { activePath: '/about' },
    });
    const anchors = wrapper.findAll('a');
    expect(anchors.length).toBe(4);
  });

  // --- CMS menu branch ---

  it('renders CMS menu items when configured and non-empty', () => {
    mockIsConfigured.value = true;
    mockError.value = null;
    mockMenu.value = {
      id: '1',
      title: 'Info pages',
      menuItems: [
        { id: '1', label: 'Om oss', canonicalUrl: '/se/sv/om-oss', order: 1 },
        { id: '2', label: 'Villkor', canonicalUrl: '/se/sv/villkor', order: 2 },
      ],
    };
    const wrapper = mountComponent(InfoPageSidebar, {
      props: { activePath: '/om-oss' },
    });
    const anchors = wrapper.findAll('a');
    expect(anchors.length).toBe(2);

    // normalizeMenuUrl strips /se/sv/ prefix leaving /om-oss, then localePath adds /se/sv
    const hrefs = anchors.map((a) => a.attributes('href'));
    expect(hrefs).toContain('/se/sv/om-oss');
    expect(hrefs).toContain('/se/sv/villkor');

    const labels = anchors.map((a) => a.text());
    expect(labels).toContain('Om oss');
    expect(labels).toContain('Villkor');
  });

  it('does not render hardcoded fallback labels when CMS menu is active', () => {
    mockIsConfigured.value = true;
    mockError.value = null;
    mockMenu.value = {
      id: '1',
      title: 'Info pages',
      menuItems: [
        { id: '1', label: 'Om oss', canonicalUrl: '/se/sv/om-oss', order: 1 },
      ],
    };
    const wrapper = mountComponent(InfoPageSidebar, {
      props: { activePath: '/om-oss' },
    });
    const text = wrapper.text();
    expect(text).not.toContain('layout.about_us');
    expect(text).not.toContain('layout.contact');
    expect(text).not.toContain('layout.apply_for_account');
    expect(text).not.toContain('layout.terms');
  });

  // --- Active state in fallback branch ---

  it('marks active fallback link via activePath prop', () => {
    mockIsConfigured.value = false;
    mockRoutePath.value = '/se/sv/about';
    const wrapper = mountComponent(InfoPageSidebar, {
      props: { activePath: '/about' },
    });
    const anchors = wrapper.findAll('a');
    const aboutAnchor = anchors.find(
      (a) => a.attributes('href') === '/se/sv/about',
    );
    expect(aboutAnchor).toBeTruthy();
    expect(aboutAnchor!.attributes('aria-current')).toBe('page');
    expect(aboutAnchor!.classes()).toContain('bg-accent');

    const termsAnchor = anchors.find(
      (a) => a.attributes('href') === '/se/sv/terms',
    );
    expect(termsAnchor!.attributes('aria-current')).toBeUndefined();
    expect(termsAnchor!.classes()).not.toContain('bg-accent');
  });

  it('marks active fallback link when route.path exactly matches href', () => {
    mockIsConfigured.value = false;
    mockRoutePath.value = '/se/sv/terms';
    const wrapper = mountComponent(InfoPageSidebar, {
      props: { activePath: '/terms' },
    });
    const anchors = wrapper.findAll('a');
    const termsAnchor = anchors.find(
      (a) => a.attributes('href') === '/se/sv/terms',
    );
    expect(termsAnchor!.attributes('aria-current')).toBe('page');
  });

  // --- Active state in CMS branch ---

  it('marks active CMS link when route.path ends with activePath', () => {
    mockIsConfigured.value = true;
    mockError.value = null;
    mockMenu.value = {
      id: '1',
      title: 'Info pages',
      menuItems: [
        { id: '1', label: 'Om oss', canonicalUrl: '/se/sv/om-oss', order: 1 },
        { id: '2', label: 'Villkor', canonicalUrl: '/se/sv/villkor', order: 2 },
      ],
    };
    mockRoutePath.value = '/se/sv/villkor';
    const wrapper = mountComponent(InfoPageSidebar, {
      props: { activePath: '/villkor' },
    });
    const anchors = wrapper.findAll('a');
    const villkorAnchor = anchors.find(
      (a) => a.attributes('href') === '/se/sv/villkor',
    );
    expect(villkorAnchor).toBeTruthy();
    expect(villkorAnchor!.attributes('aria-current')).toBe('page');
    expect(villkorAnchor!.classes()).toContain('bg-accent');

    const omOssAnchor = anchors.find(
      (a) => a.attributes('href') === '/se/sv/om-oss',
    );
    expect(omOssAnchor!.attributes('aria-current')).toBeUndefined();
    expect(omOssAnchor!.classes()).not.toContain('bg-accent');
  });

  it('marks active CMS link when route.path exactly matches derived href', () => {
    mockIsConfigured.value = true;
    mockError.value = null;
    mockMenu.value = {
      id: '1',
      title: 'Info pages',
      menuItems: [
        { id: '1', label: 'Om oss', canonicalUrl: '/se/sv/om-oss', order: 1 },
      ],
    };
    mockRoutePath.value = '/se/sv/om-oss';
    const wrapper = mountComponent(InfoPageSidebar, {
      props: { activePath: '/om-oss' },
    });
    const anchor = wrapper.find('a');
    expect(anchor.attributes('aria-current')).toBe('page');
  });

  // --- Wrapper structure preserved ---

  it('renders nav with data-testid and aria-label', () => {
    mockIsConfigured.value = false;
    const wrapper = mountComponent(InfoPageSidebar, {
      props: { activePath: '/about' },
    });
    const nav = wrapper.find('[data-testid="info-page-sidebar"]');
    expect(nav.exists()).toBe(true);
    expect(nav.attributes('aria-label')).toBe('nav.sidebar_navigation');
    expect(nav.element.tagName.toLowerCase()).toBe('nav');
  });

  it('renders ul > li structure', () => {
    mockIsConfigured.value = false;
    const wrapper = mountComponent(InfoPageSidebar, {
      props: { activePath: '/about' },
    });
    expect(wrapper.find('ul').exists()).toBe(true);
    const items = wrapper.findAll('li');
    expect(items.length).toBe(4);
  });

  // --- External link in CMS branch ---

  it('renders external CMS items as <a> with target and rel attributes', () => {
    mockIsConfigured.value = true;
    mockError.value = null;
    mockMenu.value = {
      id: '1',
      title: 'Info pages',
      menuItems: [
        {
          id: '1',
          label: 'External',
          canonicalUrl: 'https://external.example.com/page',
          order: 1,
        },
      ],
    };
    const wrapper = mountComponent(InfoPageSidebar, {
      props: { activePath: '/page' },
    });
    const anchor = wrapper.find('a');
    expect(anchor.exists()).toBe(true);
    expect(anchor.attributes('href')).toBe('https://external.example.com/page');
    expect(anchor.attributes('target')).toBe('_blank');
    expect(anchor.attributes('rel')).toBe('noopener');
  });
});

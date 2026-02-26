import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { mountComponent } from '../../utils/component';
import Content from '../../../app/components/pages/Content.vue';
import type { ContentPageType } from '#shared/types/cms';

// --- Mocks ---

const mockPage = ref<ContentPageType | null>(null);
const mockStatus = ref<string>('idle');
const mockError = ref<Error | null>(null);

const mockUseFetch = vi.fn(() => ({
  data: mockPage,
  error: mockError,
  status: mockStatus,
  pending: ref(false),
  refresh: vi.fn(),
  execute: vi.fn(),
}));

// Mock at the module level — Nuxt auto-imports resolve to these internal modules
vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args),
}));

vi.mock('#app/composables/head', () => ({
  useHead: vi.fn(),
  useHeadSafe: vi.fn(),
  useServerHead: vi.fn(),
  useServerHeadSafe: vi.fn(),
  useSeoMeta: vi.fn(),
  useServerSeoMeta: vi.fn(),
  injectHead: vi.fn(),
}));

// Also stub globally for direct access
vi.stubGlobal('useFetch', (...args: unknown[]) => mockUseFetch(...args));
vi.stubGlobal('useHead', vi.fn());
vi.stubGlobal('useRequestURL', () => new URL('https://test.example.com'));

// Stubs for child components
const stubs = {
  CmsWidgetArea: {
    template: '<div data-testid="widget-area"><slot /></div>',
    props: ['containers'],
  },
  PageSidebarNav: {
    template:
      '<nav data-testid="sidebar-nav" :data-menu-id="menuLocationId"></nav>',
    props: ['menuLocationId'],
  },
  PagesPageSidebarNav: {
    template:
      '<nav data-testid="sidebar-nav" :data-menu-id="menuLocationId"></nav>',
    props: ['menuLocationId'],
  },
  ErrorBoundary: {
    template: '<div><slot /></div>',
    props: ['section'],
  },
  SharedErrorBoundary: {
    template: '<div><slot /></div>',
    props: ['section'],
  },
  ContentPageSkeleton: {
    template: '<div data-testid="content-loading" />',
  },
  PagesContentPageSkeleton: {
    template: '<div data-testid="content-loading" />',
  },
  EmptyState: {
    template: "<div :data-testid=\"$attrs['data-testid'] || 'empty-state'\" />",
    props: ['icon', 'title', 'description', 'actionLabel', 'actionTo'],
  },
  SharedEmptyState: {
    template: "<div :data-testid=\"$attrs['data-testid'] || 'empty-state'\" />",
    props: ['icon', 'title', 'description', 'actionLabel', 'actionTo'],
  },
};

function createPage(overrides: Partial<ContentPageType> = {}): ContentPageType {
  return {
    meta: { title: 'Test Page', description: 'A test page' },
    tags: [],
    containers: [
      {
        id: 'c1',
        name: 'main',
        sortOrder: 0,
        layout: 'full',
        design: '',
        responsiveMode: 'default',
        widgets: [],
      },
    ],
    ...overrides,
  };
}

describe('Content.vue', () => {
  beforeEach(() => {
    mockPage.value = null;
    mockStatus.value = 'idle';
    mockError.value = null;
    mockUseFetch.mockClear();
  });

  it('renders full-width layout when page has no pageArea', () => {
    mockPage.value = createPage();
    mockStatus.value = 'success';

    const wrapper = mountComponent(Content, {
      props: { resolution: { pageSlug: 'about' } },
      global: { stubs },
    });

    // Widget area should be rendered
    expect(wrapper.find('[data-testid="widget-area"]').exists()).toBe(true);
    // No sidebar nav should be present
    expect(wrapper.find('[data-testid="sidebar-nav"]').exists()).toBe(false);
    // Should not have the flex sidebar layout
    expect(wrapper.find('.md\\:flex').exists()).toBe(false);
  });

  it('renders sidebar layout when page has pageArea with name', () => {
    mockPage.value = createPage({
      pageArea: { id: 'pa1', name: 'info-pages', index: 0 },
    });
    mockStatus.value = 'success';

    const wrapper = mountComponent(Content, {
      props: { resolution: { pageSlug: 'about' } },
      global: { stubs },
    });

    // Sidebar nav should be present with correct menuLocationId
    const sidebarNav = wrapper.find('[data-testid="sidebar-nav"]');
    expect(sidebarNav.exists()).toBe(true);
    expect(sidebarNav.attributes('data-menu-id')).toBe('info-pages');

    // Widget area should also be present (inside the flex container)
    expect(wrapper.find('[data-testid="widget-area"]').exists()).toBe(true);

    // Should have the sidebar flex layout
    expect(wrapper.find('.md\\:flex').exists()).toBe(true);
  });

  it('renders loading skeleton when status is pending', () => {
    mockStatus.value = 'pending';

    const wrapper = mountComponent(Content, {
      props: { resolution: { pageSlug: 'about' } },
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="content-loading"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="widget-area"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="sidebar-nav"]').exists()).toBe(false);
  });

  it('renders error state when fetch fails', () => {
    mockError.value = new Error('Network error');
    mockStatus.value = 'error';

    const wrapper = mountComponent(Content, {
      props: { resolution: { pageSlug: 'about' } },
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="content-error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="widget-area"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="sidebar-nav"]').exists()).toBe(false);
  });
});

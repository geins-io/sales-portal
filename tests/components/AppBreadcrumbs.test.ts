import { describe, it, expect } from 'vitest';
import { mountComponent } from '../utils/component';
import AppBreadcrumbs from '../../app/components/shared/AppBreadcrumbs.vue';

// Stub both unprefixed and Ui-prefixed names (Nuxt component resolution gotcha)
const breadcrumbStubs = {
  Breadcrumb: { template: '<nav><slot /></nav>' },
  BreadcrumbList: { template: '<ol><slot /></ol>' },
  BreadcrumbItem: { template: '<li><slot /></li>' },
  BreadcrumbLink: { template: '<a><slot /></a>' },
  BreadcrumbPage: { template: '<span><slot /></span>' },
  BreadcrumbSeparator: { template: '<li>/</li>' },
  BreadcrumbEllipsis: { template: '<li>...</li>' },
  UiBreadcrumb: { template: '<nav><slot /></nav>' },
  UiBreadcrumbList: { template: '<ol><slot /></ol>' },
  UiBreadcrumbItem: { template: '<li><slot /></li>' },
  UiBreadcrumbLink: { template: '<a><slot /></a>' },
  UiBreadcrumbPage: { template: '<span><slot /></span>' },
  UiBreadcrumbSeparator: { template: '<li>/</li>' },
  UiBreadcrumbEllipsis: { template: '<li>...</li>' },
};

describe('AppBreadcrumbs', () => {
  const mountOptions = { global: { stubs: breadcrumbStubs } };

  it('renders all items', () => {
    const wrapper = mountComponent(AppBreadcrumbs, {
      ...mountOptions,
      props: {
        items: [
          { label: 'Home', href: '/' },
          { label: 'Category', href: '/category' },
          { label: 'Product' },
        ],
      },
    });
    expect(wrapper.text()).toContain('Home');
    expect(wrapper.text()).toContain('Category');
    expect(wrapper.text()).toContain('Product');
  });

  it('renders last item as current page (no link)', () => {
    const wrapper = mountComponent(AppBreadcrumbs, {
      ...mountOptions,
      props: {
        items: [{ label: 'Home', href: '/' }, { label: 'Current Page' }],
      },
    });
    const spans = wrapper.findAll('span');
    const lastSpan = spans[spans.length - 1];
    expect(lastSpan.text()).toBe('Current Page');
  });

  it('renders nothing when items is empty', () => {
    const wrapper = mountComponent(AppBreadcrumbs, {
      ...mountOptions,
      props: { items: [] },
    });
    expect(wrapper.find('nav').exists()).toBe(false);
  });

  it('does not collapse when 4 or fewer items', () => {
    const wrapper = mountComponent(AppBreadcrumbs, {
      ...mountOptions,
      props: {
        items: [
          { label: 'Home', href: '/' },
          { label: 'Level 1', href: '/l1' },
          { label: 'Level 2', href: '/l2' },
          { label: 'Current Page' },
        ],
      },
    });
    expect(wrapper.text()).toContain('Home');
    expect(wrapper.text()).toContain('Level 1');
    expect(wrapper.text()).toContain('Level 2');
    expect(wrapper.text()).toContain('Current Page');
    expect(wrapper.text()).not.toContain('...');
  });

  it('collapses middle items with ellipsis when 5+ items', () => {
    const wrapper = mountComponent(AppBreadcrumbs, {
      ...mountOptions,
      props: {
        items: [
          { label: 'Home', href: '/' },
          { label: 'Level 1', href: '/l1' },
          { label: 'Level 2', href: '/l2' },
          { label: 'Level 3', href: '/l3' },
          { label: 'Current Page' },
        ],
      },
    });
    expect(wrapper.text()).toContain('Home');
    expect(wrapper.text()).toContain('...');
    expect(wrapper.text()).toContain('Level 3');
    expect(wrapper.text()).toContain('Current Page');
    expect(wrapper.text()).not.toContain('Level 1');
    expect(wrapper.text()).not.toContain('Level 2');
  });

  it('renders separators between items', () => {
    const wrapper = mountComponent(AppBreadcrumbs, {
      ...mountOptions,
      props: {
        items: [{ label: 'Home', href: '/' }, { label: 'Page' }],
      },
    });
    expect(wrapper.text()).toContain('/');
  });
});

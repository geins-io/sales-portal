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
  BreadcrumbSeparator: {
    template: '<li data-slot="breadcrumb-separator">/</li>',
  },
  BreadcrumbEllipsis: {
    template: '<li data-slot="breadcrumb-ellipsis">...</li>',
  },
  UiBreadcrumb: { template: '<nav><slot /></nav>' },
  UiBreadcrumbList: { template: '<ol><slot /></ol>' },
  UiBreadcrumbItem: { template: '<li><slot /></li>' },
  UiBreadcrumbLink: { template: '<a><slot /></a>' },
  UiBreadcrumbPage: { template: '<span><slot /></span>' },
  UiBreadcrumbSeparator: {
    template: '<li data-slot="breadcrumb-separator">/</li>',
  },
  UiBreadcrumbEllipsis: {
    template: '<li data-slot="breadcrumb-ellipsis">...</li>',
  },
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
    expect(lastSpan?.text()).toBe('Current Page');
  });

  it('renders nothing when items is empty', () => {
    const wrapper = mountComponent(AppBreadcrumbs, {
      ...mountOptions,
      props: { items: [] },
    });
    expect(wrapper.find('nav').exists()).toBe(false);
  });

  it('renders every item of a short trail', () => {
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

  const deepTrail = [
    { label: 'Home', href: '/' },
    { label: 'Level 1', href: '/l1' },
    { label: 'Level 2', href: '/l2' },
    { label: 'Level 3', href: '/l3' },
    { label: 'Level 4', href: '/l4' },
    { label: 'Level 5', href: '/l5' },
    { label: 'Level 6', href: '/l6' },
    { label: 'Current Page' },
  ];

  it('renders every level of a deep trail', () => {
    const wrapper = mountComponent(AppBreadcrumbs, {
      ...mountOptions,
      props: { items: deepTrail },
    });
    for (const item of deepTrail) {
      expect(wrapper.text()).toContain(item.label);
    }
  });

  it('renders no ellipsis at any trail length', () => {
    for (const length of [2, 5, 8]) {
      const wrapper = mountComponent(AppBreadcrumbs, {
        ...mountOptions,
        props: { items: deepTrail.slice(0, length) },
      });
      expect(wrapper.find('[data-slot="breadcrumb-ellipsis"]').exists()).toBe(
        false,
      );
      expect(wrapper.text()).not.toContain('...');
    }
  });

  it('renders exactly one separator per gap between items', () => {
    for (const length of [2, 5, 8]) {
      const wrapper = mountComponent(AppBreadcrumbs, {
        ...mountOptions,
        props: { items: deepTrail.slice(0, length) },
      });
      expect(wrapper.findAll('[data-name="chevron-right"]')).toHaveLength(
        length - 1,
      );
      expect(
        wrapper.findAll('[data-slot="breadcrumb-separator"]'),
      ).toHaveLength(0);
    }
  });

  it('renders each separator inside the crumb it precedes', () => {
    const wrapper = mountComponent(AppBreadcrumbs, {
      ...mountOptions,
      props: {
        items: [{ label: 'Home', href: '/' }, { label: 'Page' }],
      },
    });
    const [first, second] = wrapper.findAll('li');
    expect(first?.find('[data-name="chevron-right"]').exists()).toBe(false);
    expect(second?.find('[data-name="chevron-right"]').exists()).toBe(true);
  });

  it('renders no separator for a single-item trail', () => {
    const wrapper = mountComponent(AppBreadcrumbs, {
      ...mountOptions,
      props: { items: [{ label: 'Home', href: '/' }] },
    });
    expect(wrapper.find('[data-name="chevron-right"]').exists()).toBe(false);
  });
});

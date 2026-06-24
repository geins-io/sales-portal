import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import ProductListHeader from '../../../app/components/product/ProductListHeader.vue';
import type { ListPageInfo } from '../../../shared/types/commerce';

const stubs = {
  AppBreadcrumbs: {
    template: '<nav data-stub="breadcrumbs" />',
    props: ['items'],
  },
};

function makePageInfo(overrides: Partial<ListPageInfo> = {}): ListPageInfo {
  return {
    id: '1',
    name: 'Förbrukningsmaterial',
    hideTitle: false,
    hideDescription: false,
    primaryDescription: '',
    subCategories: [],
    ...overrides,
  } as unknown as ListPageInfo;
}

function mountHeader(pageInfo: ListPageInfo) {
  return mountComponent(ProductListHeader, {
    props: { pageInfo, breadcrumbs: [], resultCount: 0 },
    global: { stubs },
  });
}

describe('ProductListHeader title', () => {
  it('renders the title at text-3xl on mobile and text-5xl on md and up', () => {
    const h1 = mountHeader(makePageInfo()).find('h1');
    expect(h1.exists()).toBe(true);
    expect(h1.classes()).toContain('text-3xl');
    expect(h1.classes()).toContain('md:text-5xl');
    // The base size must be text-3xl, not the old unconditional text-5xl.
    expect(h1.classes()).not.toContain('text-5xl');
  });

  it('allows long single words to wrap so the title never overflows', () => {
    expect(mountHeader(makePageInfo()).find('h1').classes()).toContain(
      'break-words',
    );
  });

  it('hides the title when pageInfo.hideTitle is set', () => {
    expect(
      mountHeader(makePageInfo({ hideTitle: true }))
        .find('h1')
        .exists(),
    ).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import SearchFilesPlaceholder from '../../../app/components/search/SearchFilesPlaceholder.vue';

const stubs = {
  EmptyState: {
    template:
      '<div :data-testid="$attrs[\'data-testid\'] || \'empty-state\'"><span data-testid="title">{{ title }}</span><span v-if="description" data-testid="description">{{ description }}</span></div>',
    props: ['icon', 'title', 'description'],
  },
  SharedEmptyState: {
    template:
      '<div :data-testid="$attrs[\'data-testid\'] || \'empty-state\'"><span data-testid="title">{{ title }}</span><span v-if="description" data-testid="description">{{ description }}</span></div>',
    props: ['icon', 'title', 'description'],
  },
};

describe('SearchFilesPlaceholder', () => {
  it('renders the placeholder section with correct test id', () => {
    const wrapper = mountComponent(SearchFilesPlaceholder, {
      global: { stubs },
    });

    expect(
      wrapper.find('[data-testid="search-files-placeholder"]').exists(),
    ).toBe(true);
  });

  it('renders the files section title', () => {
    const wrapper = mountComponent(SearchFilesPlaceholder, {
      global: { stubs },
    });

    expect(wrapper.text()).toContain('search.files_title');
  });

  it('renders the coming soon message', () => {
    const wrapper = mountComponent(SearchFilesPlaceholder, {
      global: { stubs },
    });

    expect(wrapper.text()).toContain('search.files_coming_soon');
  });

  it('renders the description text', () => {
    const wrapper = mountComponent(SearchFilesPlaceholder, {
      global: { stubs },
    });

    expect(wrapper.text()).toContain('search.files_coming_soon_description');
  });
});

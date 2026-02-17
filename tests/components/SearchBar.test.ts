import { describe, it, expect } from 'vitest';
import { mountComponent } from '../utils/component';
import SearchBar from '../../app/components/shared/SearchBar.vue';

describe('SearchBar', () => {
  it('renders a search input with placeholder', () => {
    const wrapper = mountComponent(SearchBar);
    const input = wrapper.find('input[type="text"]');
    expect(input.exists()).toBe(true);
    expect(input.attributes('placeholder')).toBeTruthy();
  });

  it('emits search event on Enter key', async () => {
    const wrapper = mountComponent(SearchBar);
    const input = wrapper.find('input[type="text"]');
    await input.setValue('test query');
    await input.trigger('keydown.enter');
    expect(wrapper.emitted('search')?.[0]?.[0]).toBe('test query');
  });

  it('clears input when clear button is clicked', async () => {
    const wrapper = mountComponent(SearchBar);
    const input = wrapper.find('input[type="text"]');
    await input.setValue('test query');
    const clearBtn = wrapper.find('[data-slot="search-clear"]');
    expect(clearBtn.exists()).toBe(true);
    await clearBtn.trigger('click');
    expect((input.element as HTMLInputElement).value).toBe('');
  });

  it('hides clear button when input is empty', () => {
    const wrapper = mountComponent(SearchBar);
    const clearBtn = wrapper.find('[data-slot="search-clear"]');
    expect(clearBtn.exists()).toBe(false);
  });

  it('renders search icon', () => {
    const wrapper = mountComponent(SearchBar);
    expect(wrapper.find('[data-slot="search-icon"]').exists()).toBe(true);
  });
});

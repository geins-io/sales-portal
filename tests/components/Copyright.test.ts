import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Copyright from '../../app/components/shared/Copyright.vue';
import { defaultMountOptions } from '../utils/component';

// Stand up an isolated $t mock that serializes params so we can verify the
// component passes year + brand into the i18n message correctly. The global
// $t mock returns only the key, which would erase the runtime substitution.
function mountCopyright() {
  return mount(Copyright, {
    ...defaultMountOptions,
    global: {
      ...defaultMountOptions.global,
      mocks: {
        ...defaultMountOptions.global?.mocks,
        $t: (key: string, params?: Record<string, unknown>) =>
          params ? `${key}::${JSON.stringify(params)}` : key,
      },
    },
  });
}

describe('Copyright Component', () => {
  it('renders with data-slot="copyright"', () => {
    const wrapper = mountCopyright();
    expect(wrapper.attributes('data-slot')).toBe('copyright');
  });

  it('uses the footer.copyright i18n key with year + brand params', () => {
    const wrapper = mountCopyright();
    const year = new Date().getFullYear();
    const text = wrapper.text();
    expect(text).toContain('footer.copyright::');
    expect(text).toContain(String(year));
    expect(text).toContain('Test Store');
  });
});

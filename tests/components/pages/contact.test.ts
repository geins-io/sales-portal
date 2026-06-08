import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, Suspense, onErrorCaptured } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { defaultMountOptions } from '../../utils/component';

// navigateTo is stubbed as a no-op by setup-components.ts. Override here so
// we can assert on calls made by the redirect page's setup.
const navigateToMock = vi.fn(() => Promise.resolve());
vi.mock('#app/composables/router', () => ({
  navigateTo: (...args: unknown[]) => navigateToMock(...args),
}));
vi.stubGlobal('navigateTo', (...args: unknown[]) => navigateToMock(...args));

// useLocaleMarket is mocked globally in setup-components.ts but we need to
// assert on localePath, so track calls via a spy on the returned function.
const localePathSpy = vi.fn(
  (path: string) => `/se/en${path.startsWith('/') ? path : '/' + path}`,
);
vi.mock('../../../app/composables/useLocaleMarket', () => ({
  useLocaleMarket: () => ({
    currentMarket: { value: 'se' },
    currentLocale: { value: 'en' },
    localePath: localePathSpy,
    localeQuery: { value: { locale: 'en', market: 'se' } },
    getCleanPath: () => '/',
    switchLocale: vi.fn(),
    switchMarket: vi.fn(),
  }),
}));

// Import the page after mocks are registered.
const { default: ContactPage } = await import('../../../app/pages/contact.vue');

async function mountContactPage() {
  const Wrapper = defineComponent({
    components: { ContactPage },
    setup() {
      // Capture any errors thrown by the async setup (e.g. navigateTo throwing
      // in some environments) so they don't surface as unhandled rejections.
      onErrorCaptured(() => false);
      return () => h(Suspense, null, { default: () => h(ContactPage) });
    },
  });
  const wrapper = mount(Wrapper, {
    global: {
      ...defaultMountOptions.global,
      stubs: {
        ...(defaultMountOptions.global?.stubs ?? {}),
      },
    },
  });
  await flushPromises();
  return wrapper;
}

describe('contact page', () => {
  beforeEach(() => {
    navigateToMock.mockClear();
    localePathSpy.mockClear();
  });

  it('redirects to the locale-prefixed /contact-form with redirectCode 301', async () => {
    await mountContactPage();

    expect(navigateToMock).toHaveBeenCalledTimes(1);
    expect(navigateToMock).toHaveBeenCalledWith(
      '/se/en/contact-form',
      expect.objectContaining({ redirectCode: 301, replace: true }),
    );
  });

  it('passes bare /contact-form to localePath, not a pre-prefixed path', async () => {
    await mountContactPage();

    expect(localePathSpy).toHaveBeenCalledWith('/contact-form');
  });

  it('does not redirect to /contact (no redirect loop)', async () => {
    await mountContactPage();

    expect(navigateToMock).toHaveBeenCalledTimes(1);
    const calls = navigateToMock.mock.calls;
    for (const [target] of calls) {
      expect(String(target)).not.toMatch(/\/contact(?!-)/);
    }
  });
});

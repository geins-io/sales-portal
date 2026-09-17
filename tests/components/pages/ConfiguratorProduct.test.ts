import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountComponent } from '../../utils/component';
import ConfiguratorProduct from '../../../app/components/pages/ConfiguratorProduct.vue';
import type { DetailProduct } from '../../../shared/types/commerce';

// ---------------------------------------------------------------------------
// The configurator shell.
//
// The form is not here yet, so what is worth a test is the part a stub cannot
// vouch for: that every component the template names actually exists under
// that name. Components are registered without a path prefix
// (`pathPrefix: false`), so `SharedGeinsImage` resolves to nothing, renders
// nothing, and only says so as a runtime warning — which a test that stubs the
// component away never sees.
// ---------------------------------------------------------------------------

vi.mock('../../../app/composables/useLocaleMarket', () => ({
  useLocaleMarket: () => ({
    currentMarket: { value: 'se' },
    currentLocale: { value: 'sv' },
    localePath: (path: string) => `/se/sv${path}`,
    localeQuery: { value: {} },
    getCleanPath: () => '/',
    switchLocale: vi.fn(),
    switchMarket: vi.fn(),
  }),
}));

const stubs = {
  AppBreadcrumbs: {
    template: '<nav data-testid="crumbs" />',
    props: ['items'],
  },
  GeinsImage: {
    template: '<img data-testid="product-image" :alt="alt" :src="fileName" />',
    props: ['fileName', 'alt', 'type', 'loading', 'fit', 'aspectRatio'],
  },
};

function makeProduct(overrides: Record<string, unknown> = {}): DetailProduct {
  return {
    productId: 1101,
    name: 'Arbetsbord Pro',
    alias: 'arbetsbord-pro',
    articleNumber: 'KONF-1001',
    productImages: [{ fileName: 'workbench.jpg', isPrimary: true, url: '' }],
    ...overrides,
  } as unknown as DetailProduct;
}

let warnings: string[] = [];
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnings = [];
  warnSpy = vi
    .spyOn(console, 'warn')
    .mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    });
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('ConfiguratorProduct', () => {
  it('renders the primary image through the component that is registered', () => {
    const wrapper = mountComponent(ConfiguratorProduct, {
      props: { product: makeProduct() },
      global: { stubs },
    });

    const image = wrapper.find('[data-testid="product-image"]');
    expect(image.exists()).toBe(true);
    expect(image.attributes('src')).toBe('workbench.jpg');
    expect(image.attributes('alt')).toBe('Arbetsbord Pro');
  });

  it('falls back to the first image when none is marked primary', () => {
    const wrapper = mountComponent(ConfiguratorProduct, {
      props: {
        product: makeProduct({
          productImages: [{ fileName: 'first.jpg', isPrimary: false, url: '' }],
        }),
      },
      global: { stubs },
    });

    expect(
      wrapper.find('[data-testid="product-image"]').attributes('src'),
    ).toBe('first.jpg');
  });

  it('names no component Vue cannot resolve', () => {
    mountComponent(ConfiguratorProduct, {
      props: { product: makeProduct() },
      global: { stubs },
    });

    expect(
      warnings.filter((line) => line.includes('Failed to resolve component')),
    ).toEqual([]);
  });

  it('renders the heading and the region the form will mount in', () => {
    const wrapper = mountComponent(ConfiguratorProduct, {
      props: { product: makeProduct() },
      global: { stubs },
    });

    expect(wrapper.find('h1').text()).toBe('Arbetsbord Pro');
    expect(
      wrapper.find('[data-testid="configurator-form-slot"]').exists(),
    ).toBe(true);
  });
});

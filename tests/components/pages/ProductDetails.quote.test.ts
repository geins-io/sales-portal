import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ref,
  computed,
  defineComponent,
  h,
  Suspense,
  type Component,
} from 'vue';
import { flushPromises } from '@vue/test-utils';
import { mountComponent, type MountOptionsFor } from '../../utils/component';
import ProductDetails from '../../../app/components/pages/ProductDetails.vue';
import type { DetailProduct } from '../../../shared/types/commerce';
import type { QuoteAddTarget } from '../../../shared/types/quote';
import { mockIsCatalogMode } from '../../setup-components';
import { useQuotesStore } from '../../../app/stores/quotes';

// ---------------------------------------------------------------------------
// "Lägg till i offertförfrågan" on the product page: where it sits and what it
// sends. The menu itself is ProductAddToQuote's own test.
// ---------------------------------------------------------------------------

async function mountProductDetails(
  props: { product: DetailProduct; alias: string },
  mountOptions: MountOptionsFor<Component> = {},
) {
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(Suspense, null, { default: () => h(ProductDetails, props) });
    },
  });
  const wrapper = mountComponent(Wrapper, mountOptions);
  await flushPromises();
  return wrapper;
}

/** Order placement can be switched off on its own; the quote flags stay on. */
const access = ref<Record<string, boolean>>({});
vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    canAccess: (name: string) => access.value[name] ?? true,
  }),
}));

const mockAddItem = vi.fn();
vi.mock('~/stores/cart', () => ({
  useCartStore: () => ({ addItem: mockAddItem, isLoading: false, cart: null }),
}));

vi.mock('../../../app/composables/useStockVisibility', () => ({
  useStockVisibility: () => ({ showStock: computed(() => true) }),
}));

const mockUseFetch = vi.fn(() => ({
  data: ref(null),
  error: ref(null),
  status: ref('success'),
  pending: ref(false),
  refresh: vi.fn(),
  execute: vi.fn(),
}));
vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: Parameters<typeof mockUseFetch>) => mockUseFetch(...args),
}));
vi.stubGlobal('useFetch', mockUseFetch);

vi.mock('#app/composables/head', () => ({
  useHead: vi.fn(),
  useHeadSafe: vi.fn(),
  useServerHead: vi.fn(),
  useServerHeadSafe: vi.fn(),
  useSeoMeta: vi.fn(),
  useServerSeoMeta: vi.fn(),
  injectHead: vi.fn(),
}));
vi.stubGlobal('useHead', vi.fn());
vi.stubGlobal('useSeoMeta', vi.fn());
vi.stubGlobal('useSchemaOrg', vi.fn());
vi.stubGlobal(
  'defineProduct',
  vi.fn(() => ({})),
);
vi.stubGlobal(
  'defineBreadcrumb',
  vi.fn(() => ({})),
);
vi.mock('@unhead/schema-org/vue', () => ({
  defineProduct: vi.fn(() => ({})),
  defineBreadcrumb: vi.fn(() => ({})),
}));
const { schemaOrgComposablePath } = vi.hoisted(() => {
  const nodeModule = require.resolve('nuxt-schema-org/schema');
  const pkgRoot = nodeModule.replace(/\/dist\/schema\..*$/, '');
  return {
    schemaOrgComposablePath: `${pkgRoot}/dist/runtime/app/composables/useSchemaOrg`,
  };
});
vi.mock(schemaOrgComposablePath, () => ({ useSchemaOrg: vi.fn() }));

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.mock('#build/fetch', () => ({
  $fetch: (...args: unknown[]) => mockFetch(...args),
}));

const stock = (totalStock: number) => ({
  inStock: totalStock,
  oversellable: 0,
  totalStock,
  static: 0,
});

function makeProduct(overrides: Record<string, unknown> = {}): DetailProduct {
  return {
    productId: 1,
    name: 'Test Product',
    alias: 'test-product',
    articleNumber: 'ART-001',
    canonicalUrl: '/products/test-product',
    brand: { name: 'Test Brand' },
    unitPrice: {
      sellingPriceIncVat: 199,
      sellingPriceIncVatFormatted: '199,00 kr',
      isDiscounted: false,
    },
    totalStock: stock(10),
    productImages: [{ fileName: 'product.jpg', isPrimary: true, url: '' }],
    skus: [{ skuId: 101, name: 'Default', stock: stock(10) }],
    texts: { text1: 'Description', text2: 'Short description' },
    discountCampaigns: [],
    discountType: 'NONE',
    ...overrides,
  } as unknown as DetailProduct;
}

/** What the page hands the menu, read back from the stub. */
const handed: {
  send?: (target: QuoteAddTarget) => Promise<unknown>;
  disabled?: boolean;
  needsChoice?: boolean;
  scope?: string;
} = {};

const AddToQuote = defineComponent({
  props: ['send', 'disabled', 'needsChoice', 'scope'],
  emits: ['choose'],
  setup(p, { emit }) {
    return () => {
      Object.assign(handed, p);
      return h('button', {
        'data-testid': 'add-to-quote-stub',
        onClick: () => emit('choose'),
      });
    };
  },
});

const openSkuSheet = vi.fn();
const Selector = defineComponent({
  props: ['modelValue', 'skuOptions', 'skuId'],
  emits: ['update:modelValue', 'update:skuId'],
  setup(_p, { emit, expose }) {
    expose({ openSkuSheet });
    return () =>
      h('button', {
        'data-testid': 'pick-1113',
        onClick: () => emit('update:skuId', 1113),
      });
  },
});

const stubs = {
  Icon: { template: '<span />', props: ['name'] },
  NuxtIcon: { template: '<span />', props: ['name'] },
  ProductGallery: true,
  AppBreadcrumbs: true,
  ErrorBoundary: { template: '<div><slot /></div>', props: ['section'] },
  SharedErrorBoundary: { template: '<div><slot /></div>', props: ['section'] },
  ProductTabs: true,
  ProductRelatedProducts: true,
  VariantSelector: Selector,
  PriceDisplay: { template: '<span />', props: ['price'] },
  SharedPriceDisplay: { template: '<span />', props: ['price'] },
  StockBadge: { template: '<span />', props: ['stock'] },
  SharedStockBadge: { template: '<span />', props: ['stock'] },
  QuantityInput: {
    template:
      '<div class="quantity-input"><button data-testid="set-quantity-4" @click="$emit(\'update:modelValue\', 4)" /></div>',
    props: ['modelValue', 'min', 'max'],
    emits: ['update:modelValue'],
  },
  SharedQuantityInput: {
    template:
      '<div class="quantity-input"><button data-testid="set-quantity-4" @click="$emit(\'update:modelValue\', 4)" /></div>',
    props: ['modelValue', 'min', 'max'],
    emits: ['update:modelValue'],
  },
  GeinsImage: true,
  SharedGeinsImage: true,
  ProductAddToQuote: AddToQuote,
};

const mount = (product = makeProduct()) =>
  mountProductDetails({ product, alias: product.alias }, { global: { stubs } });

const QUOTE = { id: 'draft-1', name: 'Etapp 2' };

describe('ProductDetails, adding to a quote request', () => {
  beforeEach(() => {
    access.value = {};
    mockIsCatalogMode.value = false;
    mockFetch.mockReset().mockResolvedValue({ quote: QUOTE });
    openSkuSheet.mockClear();
    handed.send = undefined;
    handed.disabled = undefined;
    handed.needsChoice = undefined;
    handed.scope = undefined;
  });

  it('sits under the add-to-cart row', async () => {
    const wrapper = await mount();
    const html = wrapper.html();

    expect(wrapper.find('[data-testid="add-to-quote-stub"]').exists()).toBe(
      true,
    );
    expect(html.indexOf('data-testid="add-to-cart-button"')).toBeLessThan(
      html.indexOf('data-testid="add-to-quote-stub"'),
    );
  });

  it("adds the SKU at the add-to-cart amount to the picked draft, leaving the buyer's cart alone", async () => {
    const wrapper = await mount();
    await wrapper.find('[data-testid="set-quantity-4"]').trigger('click');

    await expect(handed.send!({ quoteId: 'draft-1' })).resolves.toEqual(QUOTE);

    expect(mockFetch).toHaveBeenCalledWith('/api/quotes/draft-1/lines', {
      method: 'POST',
      body: { skuId: 101, quantity: 4 },
    });
    expect(mockAddItem).not.toHaveBeenCalled();
  });

  it('makes a new draft with the SKU at that amount', async () => {
    const wrapper = await mount();
    await wrapper.find('[data-testid="set-quantity-4"]').trigger('click');

    await handed.send!({ name: 'Etapp 2' });

    expect(mockFetch).toHaveBeenCalledWith('/api/quotes/drafts', {
      method: 'POST',
      body: { name: 'Etapp 2', skuId: 101, quantity: 4 },
    });
  });

  it('fails the add when the server refuses it', async () => {
    mockFetch.mockRejectedValue(new Error('409'));
    await mount();

    await expect(handed.send!({ quoteId: 'draft-1' })).rejects.toThrow();
  });

  describe('stock never stops a quote', () => {
    it('stays under the out-of-stock notice, at amount 1', async () => {
      const wrapper = await mount(
        makeProduct({
          totalStock: stock(0),
          skus: [{ skuId: 101, name: 'Default', stock: stock(0) }],
        }),
      );

      expect(wrapper.find('[data-testid="oos-block"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="add-to-quote-stub"]').exists()).toBe(
        true,
      );
      expect(handed.disabled).toBeFalsy();
      await handed.send!({ quoteId: 'draft-1' });
      expect(mockFetch.mock.calls[0]![1].body).toEqual({
        skuId: 101,
        quantity: 1,
      });
    });
  });

  describe('it follows the quote flags, not order placement', () => {
    it('shows with order placement switched off', async () => {
      access.value = { orderPlacement: false };
      const wrapper = await mount();

      expect(wrapper.find('[data-testid="add-to-cart-button"]').exists()).toBe(
        false,
      );
      expect(wrapper.find('[data-testid="add-to-quote-stub"]').exists()).toBe(
        true,
      );
    });

    it('shows in catalogue mode', async () => {
      mockIsCatalogMode.value = true;
      const wrapper = await mount();

      expect(wrapper.find('[data-testid="add-to-quote-stub"]').exists()).toBe(
        true,
      );
    });
  });

  describe('a product sold in several SKUs', () => {
    const several = () =>
      makeProduct({
        skus: [
          { skuId: 1099, name: 'Klar', stock: stock(4) },
          { skuId: 1113, name: 'S', stock: stock(5) },
        ],
      });

    it('asks for a variant first: the sheet opens as for add to cart', async () => {
      const wrapper = await mount(several());

      expect(handed.needsChoice).toBe(true);
      await wrapper.find('[data-testid="add-to-quote-stub"]').trigger('click');

      expect(openSkuSheet).toHaveBeenCalledOnce();
    });

    it('sends the picked SKU', async () => {
      const wrapper = await mount(several());
      await wrapper.find('[data-testid="pick-1113"]').trigger('click');
      await flushPromises();

      expect(handed.needsChoice).toBe(false);
      await handed.send!({ quoteId: 'draft-1' });
      expect(mockFetch.mock.calls[0]![1].body.skuId).toBe(1113);
    });
  });

  describe('the notice belongs to the product it was added from', () => {
    const added = (scope: string) => ({
      scope,
      outcome: {
        kind: 'added' as const,
        id: 'draft-1',
        name: 'Etapp 2',
        created: false,
      },
    });

    it("is not on another product's page", async () => {
      const a = await mount(makeProduct({ productId: 1, alias: 'a' }));
      const scopeA = handed.scope!;
      useQuotesStore().lastAdd = added(scopeA);

      a.unmount();
      await mount(makeProduct({ productId: 2, alias: 'b' }));

      expect(handed.scope).toBeDefined();
      expect(handed.scope).not.toBe(scopeA);
      expect(useQuotesStore().lastAdd).toBeNull();
    });

    it('is gone when the page shows another product', async () => {
      const product = ref(makeProduct({ productId: 1, alias: 'a' }));
      const Wrapper = defineComponent({
        setup() {
          return () =>
            h(Suspense, null, {
              default: () =>
                h(ProductDetails, {
                  product: product.value,
                  alias: product.value.alias,
                }),
            });
        },
      });
      mountComponent(Wrapper, { global: { stubs } });
      await flushPromises();
      const scopeA = handed.scope!;
      useQuotesStore().lastAdd = added(scopeA);

      product.value = makeProduct({ productId: 2, alias: 'b' });
      await flushPromises();

      expect(handed.scope).not.toBe(scopeA);
      expect(useQuotesStore().lastAdd).toBeNull();
    });

    it("keeps another page's notice when this one goes", async () => {
      const page = await mount();
      useQuotesStore().lastAdd = added('another-page');

      page.unmount();

      expect(useQuotesStore().lastAdd).toEqual(added('another-page'));
    });
  });
});

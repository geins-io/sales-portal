import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ref } from 'vue';
import { createI18n } from 'vue-i18n';
import { mountComponent } from '../utils/component';
import CartItem from '../../app/components/cart/CartItem.vue';
import CheckoutCartItems from '../../app/components/checkout/CheckoutCartItems.vue';
import ProductTopArea from '../../app/components/product/ProductTopArea.vue';
import type { CartItemType, DetailProduct } from '../../shared/types/commerce';
import en from '../../app/locales/en.json';
import sv from '../../app/locales/sv.json';
import nb from '../../app/locales/nb.json';
import fi from '../../app/locales/fi.json';
import da from '../../app/locales/da.json';
import de from '../../app/locales/de.json';

// The real locale files through the real vue-i18n, not the tier's passthrough
// `t`: the point is what a Danish or German buyer reads.
const i18n = vi.hoisted(() => ({ global: null as unknown }));
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return { ...actual, useI18n: () => i18n.global };
});

const real = createI18n({
  legacy: false,
  locale: 'da',
  messages: { en, sv, nb, fi, da, de },
});
i18n.global = real.global;

vi.mock('../../app/composables/usePriceVisibility', () => ({
  usePriceVisibility: () => ({ showPrice: ref(true) }),
}));

const product = {
  productId: '1',
  name: 'Test Product',
  alias: 'test-product',
  articleNumber: 'ART-001',
  productImages: [],
  canonicalUrl: '/test-product',
  skus: [],
  unitPrice: { sellingPriceIncVat: 100, sellingPriceIncVatFormatted: '100 kr' },
};

const item = {
  id: 'item-1',
  skuId: 100,
  quantity: 1,
  product,
  unitPrice: product.unitPrice,
  totalPrice: product.unitPrice,
} as unknown as CartItemType;

const global = {
  stubs: {
    GeinsImage: true,
    ErrorBoundary: { template: '<slot />' },
    QuantityInput: { template: '<div />', props: ['modelValue'] },
  },
  mocks: { $t: real.global.t },
};

const LABELS = { da: 'Varenr. ART-001', de: 'Art.-Nr. ART-001' } as const;

describe('article number label', () => {
  for (const [locale, label] of Object.entries(LABELS)) {
    describe(locale, () => {
      beforeEach(() => {
        real.global.locale.value = locale as keyof typeof LABELS;
      });

      it('on the cart line', () => {
        const wrapper = mountComponent(CartItem, { props: { item }, global });
        expect(
          wrapper.find('[data-testid="cart-item-article"]').text(),
        ).toContain(label);
        expect(wrapper.text()).not.toContain('Art nr.');
      });

      it('on the checkout line', () => {
        const wrapper = mountComponent(CheckoutCartItems, {
          props: { items: [item] },
          global,
        });
        expect(wrapper.text()).toContain(label);
        expect(wrapper.text()).not.toContain('Art nr.');
      });

      it('on the product page', () => {
        const wrapper = mountComponent(ProductTopArea, {
          props: { product: product as unknown as DetailProduct },
          global,
        });
        expect(
          wrapper.find('[data-testid="product-article-number"]').text(),
        ).toBe(label);
      });
    });
  }
});

describe('article number locale texts', () => {
  const dir = resolve(__dirname, '../../app/locales');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

  it('spell the column heading as the label, without the number', () => {
    for (const file of files) {
      const { product: texts } = JSON.parse(
        readFileSync(join(dir, file), 'utf-8'),
      );
      expect(texts.article_number, file).toBe(
        `${texts.article_number_heading} {number}`,
      );
    }
  });
});

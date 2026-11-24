import { describe, it, expect, assert } from 'vitest';
import { mountComponent } from '../../utils/component';
import ProductTopArea from '../../../app/components/product/ProductTopArea.vue';
import type { DetailProduct } from '#shared/types/commerce';

function makeProduct(overrides: Record<string, unknown> = {}): DetailProduct {
  return {
    productId: 1,
    name: 'Arbetsjacka Flex',
    alias: 'arbetsjacka-flex',
    articleNumber: 'ART-2001',
    brand: { name: 'Workwear Co' },
    productImages: [],
    ...overrides,
  } as unknown as DetailProduct;
}

const stubs = {
  ProductGallery: true,
  ErrorBoundary: { template: '<div><slot /></div>' },
};

function mount(
  product = makeProduct(),
  slots: Record<string, string> = {},
): ReturnType<typeof mountComponent> {
  return mountComponent(ProductTopArea, {
    props: { product },
    slots,
    global: { stubs },
  });
}

const META = '<span data-testid="meta">In stock</span>';

describe('ProductTopArea header', () => {
  it('reads brand, name, article number, then the info slot', () => {
    const wrapper = mount(makeProduct(), {
      info: '<p data-testid="info">Info</p>',
    });

    const order = [
      'product-brand',
      'product-name',
      'product-article-number',
      'info',
    ].map((id) => wrapper.get(`[data-testid="${id}"]`).element);
    for (let i = 1; i < order.length; i++) {
      expect(
        order[i - 1]!.compareDocumentPosition(order[i]!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('sets the brand in small grey capitals, cut with an ellipsis', () => {
    const classes = mount().get('[data-testid="product-brand"]').classes();

    expect(classes).toEqual(
      expect.arrayContaining([
        'text-xs',
        'uppercase',
        'text-muted-foreground',
        'truncate',
      ]),
    );
  });

  it('sets the name at 24 px, 30 px from lg, and the article number at 14 px', () => {
    const wrapper = mount();

    expect(wrapper.get('[data-testid="product-name"]').classes()).toEqual(
      expect.arrayContaining(['text-2xl', 'lg:text-3xl']),
    );
    expect(
      wrapper.get('[data-testid="product-article-number"]').classes(),
    ).toContain('text-sm');
  });

  it('puts the meta slot at the end of the brand row', () => {
    const wrapper = mount(makeProduct(), { meta: META });

    const row = wrapper.get('[data-testid="product-brand"]').element
      .parentElement;
    assert.isNotNull(row);
    const meta = row.querySelector('[data-testid="meta"]');
    assert.isNotNull(meta);
    expect(row.lastElementChild?.contains(meta)).toBe(true);
  });

  it('keeps the meta slot at the end of the row without a brand', () => {
    const wrapper = mount(makeProduct({ brand: null }), { meta: META });

    expect(wrapper.find('[data-testid="product-brand"]').exists()).toBe(false);
    const meta = wrapper.get('[data-testid="meta"]').element;
    const row = meta.parentElement?.parentElement;
    assert.isDefined(row);
    assert.isNotNull(row);
    expect(row.lastElementChild?.contains(meta)).toBe(true);
    expect(row.children).toHaveLength(2);
  });

  it('renders no brand row with neither a brand nor meta', () => {
    const wrapper = mount(makeProduct({ brand: null }));

    const name = wrapper.get('[data-testid="product-name"]').element;
    expect(name.previousElementSibling).toBeNull();
  });

  it('puts 16 px between the groups and 20 px above them from lg only', () => {
    const column = mount().get('[data-testid="product-name"]').element
      .parentElement?.parentElement;
    assert.isDefined(column);
    assert.isNotNull(column);

    expect(Array.from(column.classList)).toEqual(
      expect.arrayContaining(['gap-4', 'lg:mt-5']),
    );
    expect(Array.from(column.classList)).not.toContain('mt-5');
  });
});

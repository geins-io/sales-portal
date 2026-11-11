// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountComponent } from '../../utils/component';
import PortalQuoteQuickAdd from '../../../app/components/portal/PortalQuoteQuickAdd.vue';

// The component's auto-imported `$fetch` comes from `#build/fetch`.
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock('#build/fetch', () => ({ $fetch: fetchMock }));

const product = (
  productId: number,
  skuIds: number[],
  configurable?: boolean,
) => ({
  productId,
  name: `Product ${productId}`,
  articleNumber: `ART-${productId}`,
  skus: skuIds.map((skuId) => ({ skuId })),
  productImages: [],
  unitPrice: {
    sellingPriceIncVatFormatted: '125 kr',
    sellingPriceExVatFormatted: '100 kr',
  },
  ...(configurable && { configurable: true }),
});

/** Answer the next search with these products. */
function answer(...products: ReturnType<typeof product>[]) {
  fetchMock.mockResolvedValueOnce({ products, count: products.length });
}

function mount(props: Record<string, unknown> = {}) {
  return mountComponent(PortalQuoteQuickAdd, {
    props,
    attachTo: document.body,
    global: { stubs: { ProductThumbnail: { template: '<span />' } } },
  });
}

async function type(wrapper: ReturnType<typeof mount>, text: string) {
  await wrapper.find('input').setValue(text);
  await vi.advanceTimersByTimeAsync(250);
  await flushPromises();
}

const hits = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('[data-testid="quote-quick-add-hit"]');
const key = (wrapper: ReturnType<typeof mount>, k: string) =>
  wrapper.find('input').trigger('keydown', { key: k });

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('PortalQuoteQuickAdd', () => {
  it('searches by what was typed, after a pause, from two characters', async () => {
    const wrapper = mount();
    await type(wrapper, 'A');
    expect(fetchMock).not.toHaveBeenCalled();

    answer(product(1, [11]));
    await type(wrapper, 'ARB-T-40');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/search/products', {
      query: { query: 'ARB-T-40', take: 6 },
    });
    expect(hits(wrapper)).toHaveLength(1);
    expect(hits(wrapper)[0]!.text()).toContain('ART-1');
    expect(wrapper.find('input').attributes('aria-expanded')).toBe('true');
  });

  it('adds a clicked hit, then clears the field and keeps its focus', async () => {
    const wrapper = mount();
    answer(product(1, [11]), product(2, [21]));
    await type(wrapper, 'prod');

    await hits(wrapper)[1]!.trigger('mousedown');
    await flushPromises();

    expect(wrapper.emitted('add')).toEqual([
      [{ skuId: 21, name: 'Product 2' }],
    ]);
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('');
    expect(document.activeElement).toBe(wrapper.find('input').element);
    expect(
      wrapper.find('[data-testid="quote-quick-add-listbox"]').exists(),
    ).toBe(false);
  });

  it('adds the first hit on Enter, and the highlighted one after the arrows', async () => {
    const wrapper = mount();
    answer(product(1, [11]), product(2, [21]), product(3, [31]));
    await type(wrapper, 'prod');
    await key(wrapper, 'Enter');

    answer(product(1, [11]), product(2, [21]), product(3, [31]));
    await type(wrapper, 'prod');
    await key(wrapper, 'ArrowDown');
    await key(wrapper, 'ArrowDown');
    await key(wrapper, 'ArrowUp');
    expect(wrapper.find('input').attributes('aria-activedescendant')).toBe(
      'quick-add-hit-1',
    );
    await key(wrapper, 'Enter');

    expect(wrapper.emitted('add')!.map(([p]) => p)).toEqual([
      { skuId: 11, name: 'Product 1' },
      { skuId: 21, name: 'Product 2' },
    ]);
  });

  it('wraps around with the arrows', async () => {
    const wrapper = mount();
    answer(product(1, [11]), product(2, [21]));
    await type(wrapper, 'prod');

    await key(wrapper, 'ArrowUp');

    expect(wrapper.find('input').attributes('aria-activedescendant')).toBe(
      'quick-add-hit-1',
    );
  });

  it('waits for the hits when Enter comes first, then adds the first', async () => {
    const wrapper = mount();
    answer(product(5, [51]));

    await wrapper.find('input').setValue('prod');
    await key(wrapper, 'Enter');
    expect(wrapper.emitted('add')).toBeUndefined();
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    expect(wrapper.emitted('add')).toEqual([
      [{ skuId: 51, name: 'Product 5' }],
    ]);
  });

  it('closes on Escape', async () => {
    const wrapper = mount();
    answer(product(1, [11]));
    await type(wrapper, 'prod');

    await key(wrapper, 'Escape');

    expect(
      wrapper.find('[data-testid="quote-quick-add-listbox"]').exists(),
    ).toBe(false);
  });

  it('says when nothing matches', async () => {
    const wrapper = mount();
    answer();
    await type(wrapper, 'zzz');

    expect(wrapper.find('[data-testid="quote-quick-add-empty"]').text()).toBe(
      'portal.quotations.draft.quick_add_no_hits',
    );
  });

  it('shows a configurable product without an add, and says why', async () => {
    const wrapper = mount();
    answer(product(9, [91], true), product(2, [21]));
    await type(wrapper, 'prod');

    const configurable = hits(wrapper)[0]!;
    expect(configurable.attributes('aria-disabled')).toBe('true');
    expect(
      configurable.find('[data-testid="quote-quick-add-blocked"]').text(),
    ).toBe('portal.quotations.draft.quick_add_configurable');
    await configurable.trigger('mousedown');
    expect(wrapper.emitted('add')).toBeUndefined();

    // Enter passes it over for the first product that can be added.
    await key(wrapper, 'Enter');
    expect(wrapper.emitted('add')).toEqual([
      [{ skuId: 21, name: 'Product 2' }],
    ]);
  });

  it('shows a product with several variants without an add, and says why', async () => {
    const wrapper = mount();
    answer(product(4, [41, 42]));
    await type(wrapper, 'prod');

    expect(
      hits(wrapper)[0]!.find('[data-testid="quote-quick-add-blocked"]').text(),
    ).toBe('portal.quotations.draft.quick_add_variants');
    await key(wrapper, 'Enter');
    expect(wrapper.emitted('add')).toBeUndefined();
  });

  it('keeps a slower, older answer from replacing a newer one', async () => {
    const wrapper = mount();
    let answerOld!: (v: unknown) => void;
    fetchMock.mockReturnValueOnce(new Promise((r) => (answerOld = r)));
    await type(wrapper, 'old');
    answer(product(2, [21]));
    await type(wrapper, 'new');

    answerOld({ products: [product(1, [11])], count: 1 });
    await flushPromises();

    expect(hits(wrapper).map((h) => h.text())).toEqual([
      expect.stringContaining('Product 2'),
    ]);
  });

  it('adds nothing while an add is being saved', async () => {
    const wrapper = mount({ pending: true });
    answer(product(1, [11]));
    await type(wrapper, 'prod');

    await key(wrapper, 'Enter');

    expect(wrapper.emitted('add')).toBeUndefined();
    expect(
      wrapper.find('[data-testid="quote-quick-add-loading"]').exists(),
    ).toBe(true);
  });

  it('closes and searches nothing when the text gets shorter than two characters', async () => {
    const wrapper = mount();
    answer(product(1, [11]));
    await type(wrapper, 'prod');

    await type(wrapper, 'p');

    expect(
      wrapper.find('[data-testid="quote-quick-add-listbox"]').exists(),
    ).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

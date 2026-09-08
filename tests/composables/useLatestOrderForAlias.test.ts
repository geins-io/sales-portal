// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import { ref } from 'vue';

// The signature is the one the composable calls useFetch with, so the url
// factory and the options object are checked instead of inferred as zero
// arguments.
type LatestOrderFetch = (
  url: () => string,
  options: {
    immediate: boolean;
    lazy: boolean;
    dedupe: string;
    watch: unknown[];
  },
) => unknown;

const useFetchMock = vi.fn<LatestOrderFetch>();
const authStoreMock = { isAuthenticated: true };

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: Parameters<LatestOrderFetch>) => useFetchMock(...args),
}));

vi.stubGlobal('useFetch', useFetchMock);

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

const { useLatestOrderForAlias } =
  await import('../../app/composables/useLatestOrderForAlias');

beforeEach(() => {
  useFetchMock.mockReset();
  authStoreMock.isAuthenticated = true;
});

describe('useLatestOrderForAlias', () => {
  it('builds the by-alias endpoint url from the alias getter', () => {
    useFetchMock.mockReturnValue({
      data: ref({ product: null }),
      pending: ref(false),
      error: ref(null),
      refresh: vi.fn(),
    });

    useLatestOrderForAlias('grenror-150-150-88');

    const call = useFetchMock.mock.calls[0];
    assert.isDefined(call);
    const [urlFactory] = call;
    expect(typeof urlFactory).toBe('function');
    expect(urlFactory()).toBe(
      '/api/orders/products/by-alias/grenror-150-150-88',
    );
  });

  it('skips the immediate fetch when the user is not authenticated', () => {
    authStoreMock.isAuthenticated = false;
    useFetchMock.mockReturnValue({
      data: ref(null),
      pending: ref(false),
      error: ref(null),
      refresh: vi.fn(),
    });

    useLatestOrderForAlias('foo');

    const call = useFetchMock.mock.calls[0];
    assert.isDefined(call);
    const [, opts] = call;
    expect(opts.immediate).toBe(false);
  });

  it('skips the immediate fetch when alias is empty', () => {
    useFetchMock.mockReturnValue({
      data: ref(null),
      pending: ref(false),
      error: ref(null),
      refresh: vi.fn(),
    });

    useLatestOrderForAlias('');

    const call = useFetchMock.mock.calls[0];
    assert.isDefined(call);
    const [, opts] = call;
    expect(opts.immediate).toBe(false);
  });

  it('returns the product summary when the endpoint resolves', () => {
    useFetchMock.mockReturnValue({
      data: ref({
        product: {
          alias: 'grenror-150-150-88',
          name: 'Grenrör 150/150-88',
          articleNumber: 'S1-243-088',
          imageFileName: null,
          priceExVat: 1000,
          totalQuantity: 2,
          latestOrderDate: '2026-05-18T12:34:56Z',
          latestOrderId: '1421',
          latestOrderPublicId: 'pub-1421',
          latestBuyerName: 'Test User',
        },
      }),
      pending: ref(false),
      error: ref(null),
      refresh: vi.fn(),
    });

    const { latestOrder, formattedDate } =
      useLatestOrderForAlias('grenror-150-150-88');

    expect(latestOrder.value?.latestOrderId).toBe('1421');
    expect(formattedDate.value).toBe('2026-05-18');
  });

  it('exposes empty formattedDate when no order is present', () => {
    useFetchMock.mockReturnValue({
      data: ref({ product: null }),
      pending: ref(false),
      error: ref(null),
      refresh: vi.fn(),
    });

    const { latestOrder, formattedDate } = useLatestOrderForAlias('foo');

    expect(latestOrder.value).toBeNull();
    expect(formattedDate.value).toBe('');
  });
});

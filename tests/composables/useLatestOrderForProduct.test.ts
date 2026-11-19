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

const { useLatestOrderForProduct } =
  await import('../../app/composables/useLatestOrderForProduct');

beforeEach(() => {
  useFetchMock.mockReset();
  authStoreMock.isAuthenticated = true;
});

describe('useLatestOrderForProduct', () => {
  it('builds the by-id endpoint url from the product id', () => {
    useFetchMock.mockReturnValue({
      data: ref({ order: null }),
      pending: ref(false),
      error: ref(null),
      refresh: vi.fn(),
    });

    useLatestOrderForProduct(1031);

    const call = useFetchMock.mock.calls[0];
    assert.isDefined(call);
    const [urlFactory] = call;
    expect(typeof urlFactory).toBe('function');
    expect(urlFactory()).toBe('/api/orders/products/by-id/1031');
  });

  it('skips the immediate fetch when the user is not authenticated', () => {
    authStoreMock.isAuthenticated = false;
    useFetchMock.mockReturnValue({
      data: ref(null),
      pending: ref(false),
      error: ref(null),
      refresh: vi.fn(),
    });

    useLatestOrderForProduct(1031);

    const call = useFetchMock.mock.calls[0];
    assert.isDefined(call);
    const [, opts] = call;
    expect(opts.immediate).toBe(false);
  });

  it.each([undefined, null, 0])(
    'skips the immediate fetch without a product id (%j)',
    (productId) => {
      useFetchMock.mockReturnValue({
        data: ref(null),
        pending: ref(false),
        error: ref(null),
        refresh: vi.fn(),
      });

      useLatestOrderForProduct(productId);

      const call = useFetchMock.mock.calls[0];
      assert.isDefined(call);
      const [, opts] = call;
      expect(opts.immediate).toBe(false);
    },
  );

  it('fetches at once for a signed-in buyer with a product id', () => {
    useFetchMock.mockReturnValue({
      data: ref(null),
      pending: ref(false),
      error: ref(null),
      refresh: vi.fn(),
    });

    useLatestOrderForProduct(1031);

    const call = useFetchMock.mock.calls[0];
    assert.isDefined(call);
    const [, opts] = call;
    expect(opts).toMatchObject({
      immediate: true,
      lazy: true,
      dedupe: 'defer',
    });
  });

  it('returns the order and its date when the endpoint resolves', () => {
    useFetchMock.mockReturnValue({
      data: ref({
        order: {
          id: '1421',
          publicId: 'pub-1421',
          createdAt: '2026-05-18T12:34:56Z',
        },
      }),
      pending: ref(false),
      error: ref(null),
      refresh: vi.fn(),
    });

    const { latestOrder, formattedDate } = useLatestOrderForProduct(1031);

    expect(latestOrder.value).toEqual({
      id: '1421',
      publicId: 'pub-1421',
      createdAt: '2026-05-18T12:34:56Z',
    });
    expect(formattedDate.value).toBe('2026-05-18');
  });

  it('exposes empty formattedDate when no order is present', () => {
    useFetchMock.mockReturnValue({
      data: ref({ order: null }),
      pending: ref(false),
      error: ref(null),
      refresh: vi.fn(),
    });

    const { latestOrder, formattedDate } = useLatestOrderForProduct(1031);

    expect(latestOrder.value).toBeNull();
    expect(formattedDate.value).toBe('');
  });
});

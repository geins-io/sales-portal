// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { CMS_MENUS } from '../../shared/constants/cms';

// A server render waits on the menu; a retry after a timed-out read doubles
// that wait, so both menu fetches must send it once.
type MenuFetch = (url: string, options: Record<string, unknown>) => unknown;

const useFetchMock = vi.fn<MenuFetch>();

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: Parameters<MenuFetch>) => useFetchMock(...args),
}));
vi.stubGlobal('useFetch', useFetchMock);

const localeMarket = () => ({
  localeQuery: computed(() => ({ locale: 'sv', market: 'se' })),
});
vi.mock('../../app/composables/useLocaleMarket', () => ({
  useLocaleMarket: localeMarket,
}));
vi.stubGlobal('useLocaleMarket', localeMarket);

const cmsMenu = () => computed(() => ({ menuLocationId: 'main' }));
vi.mock('../../app/composables/useCmsMenu', () => ({ useCmsMenu: cmsMenu }));
vi.stubGlobal('useCmsMenu', cmsMenu);

const { useMenuData } = await import('../../app/composables/useMenuData');
const { useCmsMenuData } = await import('../../app/composables/useCmsMenuData');

beforeEach(() => {
  useFetchMock.mockReset();
  useFetchMock.mockReturnValue({
    data: ref(null),
    pending: ref(false),
    error: ref(null),
  });
});

describe('menu fetches', () => {
  it('useMenuData sends the read once, with no retry', () => {
    useMenuData('main');

    const [url, options] = useFetchMock.mock.calls[0]!;
    expect(url).toBe('/api/cms/menu');
    expect(options.retry).toBe(0);
  });

  it('useCmsMenuData sends the read once, with no retry', () => {
    useCmsMenuData(CMS_MENUS.HEADER_MAIN);

    const [url, options] = useFetchMock.mock.calls[0]!;
    expect(url).toBe('/api/cms/menu');
    expect(options.retry).toBe(0);
  });
});

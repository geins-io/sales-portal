import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

const mockGetMenu = vi.fn();
vi.mock('../../../../server/services/cms', () => ({
  getMenu: (...args: unknown[]) => mockGetMenu(...args),
}));

vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal('getValidatedQuery', vi.fn());
vi.stubGlobal('withErrorHandling', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => new Error(`${code}: ${msg}`)),
);
vi.stubGlobal('ErrorCode', {
  BAD_REQUEST: 'BAD_REQUEST',
});

describe('GET /api/cms/menu', () => {
  const mockEvent = {} as import('h3').H3Event;

  beforeEach(() => {
    vi.clearAllMocks();
    (
      globalThis.getValidatedQuery as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      menuLocationId: 'main-menu',
    });
  });

  it('returns menu data on success', async () => {
    const mockMenuData = {
      id: 'main-menu',
      items: [{ title: 'Home', url: '/' }],
    };
    mockGetMenu.mockResolvedValue(mockMenuData);

    const handler = (await import('../../../../server/api/cms/menu.get'))
      .default;
    const result = await handler(mockEvent);

    expect(mockGetMenu).toHaveBeenCalledWith(
      { menuLocationId: 'main-menu' },
      mockEvent,
    );
    expect(result).toEqual(mockMenuData);
  });

  it('calls getMenu with parsed menuLocationId', async () => {
    (
      globalThis.getValidatedQuery as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      menuLocationId: 'footer-menu',
    });
    mockGetMenu.mockResolvedValue({ id: 'footer-menu', items: [] });

    const handler = (await import('../../../../server/api/cms/menu.get'))
      .default;
    await handler(mockEvent);

    expect(mockGetMenu).toHaveBeenCalledWith(
      { menuLocationId: 'footer-menu' },
      mockEvent,
    );
  });

  it('throws when getMenu rejects', async () => {
    mockGetMenu.mockRejectedValue(new Error('CMS service error'));

    const handler = (await import('../../../../server/api/cms/menu.get'))
      .default;
    await expect(handler(mockEvent)).rejects.toThrow('CMS service error');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

vi.mock('../../../server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockAreaGet = vi.fn().mockResolvedValue({ widgets: [] });
const mockPageGet = vi.fn().mockResolvedValue({ content: '' });
const mockMenuGet = vi.fn().mockResolvedValue({ items: [] });

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue({
    cms: {
      area: { get: (...args: unknown[]) => mockAreaGet(...args) },
      page: { get: (...args: unknown[]) => mockPageGet(...args) },
      menu: { get: (...args: unknown[]) => mockMenuGet(...args) },
    },
  }),
}));

const getPreviewCookieMock = vi.fn().mockReturnValue(false);
vi.stubGlobal('getPreviewCookie', getPreviewCookieMock);
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());

const { getContentArea, getPage, getMenu } =
  await import('../../../server/services/cms');

const mockEvent = {} as H3Event;

describe('CMS service preview injection', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getContentArea', () => {
    it('passes preview: true when preview cookie is set', async () => {
      getPreviewCookieMock.mockReturnValue(true);
      await getContentArea(
        { family: 'StartPage', areaName: 'Hero' },
        mockEvent,
      );

      expect(mockAreaGet).toHaveBeenCalledWith({
        family: 'StartPage',
        areaName: 'Hero',
        preview: true,
      });
    });

    it('does NOT include preview key when not in preview', async () => {
      getPreviewCookieMock.mockReturnValue(false);
      await getContentArea(
        { family: 'StartPage', areaName: 'Hero' },
        mockEvent,
      );

      expect(mockAreaGet).toHaveBeenCalledWith({
        family: 'StartPage',
        areaName: 'Hero',
      });
    });
  });

  describe('getPage', () => {
    it('passes preview: true when in preview', async () => {
      getPreviewCookieMock.mockReturnValue(true);
      await getPage({ alias: '/about' }, mockEvent);

      expect(mockPageGet).toHaveBeenCalledWith({
        alias: '/about',
        preview: true,
      });
    });

    it('does NOT include preview key when not in preview', async () => {
      getPreviewCookieMock.mockReturnValue(false);
      await getPage({ alias: '/about' }, mockEvent);

      expect(mockPageGet).toHaveBeenCalledWith({ alias: '/about' });
    });
  });

  describe('getMenu', () => {
    it('never passes preview regardless of cookie state', async () => {
      getPreviewCookieMock.mockReturnValue(true);
      await getMenu({ menuLocationId: 'main' }, mockEvent);

      expect(mockMenuGet).toHaveBeenCalledWith({ menuLocationId: 'main' });
    });
  });
});

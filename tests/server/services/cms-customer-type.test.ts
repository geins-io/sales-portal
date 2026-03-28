import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';
import { GeinsCustomerType } from '@geins/types';

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

const channelVars = { channelId: '1', languageId: 'sv-SE', marketId: 'se' };

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue({
    cms: {
      area: { get: (...args: unknown[]) => mockAreaGet(...args) },
      page: { get: (...args: unknown[]) => mockPageGet(...args) },
      menu: { get: (...args: unknown[]) => mockMenuGet(...args) },
    },
  }),
  getRequestChannelVariables: vi.fn().mockReturnValue(channelVars),
  buildRequestContext: vi.fn().mockReturnValue(undefined),
}));

const getPreviewCookieMock = vi.fn().mockReturnValue(false);
vi.stubGlobal('getPreviewCookie', getPreviewCookieMock);
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());

const { getContentArea, getPage, getMenu } =
  await import('../../../server/services/cms');

const mockEvent = {} as H3Event;

describe('CMS service customerType threading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPreviewCookieMock.mockReturnValue(false);
  });

  describe('getPage', () => {
    it('passes customerType to SDK when provided', async () => {
      await getPage(
        { alias: '/about', customerType: GeinsCustomerType.OrganizationType },
        mockEvent,
      );

      expect(mockPageGet).toHaveBeenCalledWith(
        {
          alias: '/about',
          ...channelVars,
          customerType: GeinsCustomerType.OrganizationType,
        },
        undefined,
      );
    });

    it('omits customerType when undefined', async () => {
      await getPage({ alias: '/about' }, mockEvent);

      expect(mockPageGet).toHaveBeenCalledWith(
        {
          alias: '/about',
          ...channelVars,
        },
        undefined,
      );
    });

    it('passes both customerType and preview when both are active', async () => {
      getPreviewCookieMock.mockReturnValue(true);
      await getPage(
        { alias: '/about', customerType: GeinsCustomerType.PersonType },
        mockEvent,
      );

      expect(mockPageGet).toHaveBeenCalledWith(
        {
          alias: '/about',
          ...channelVars,
          preview: true,
          customerType: GeinsCustomerType.PersonType,
        },
        undefined,
      );
    });
  });

  describe('getContentArea', () => {
    it('passes customerType to SDK when provided', async () => {
      await getContentArea(
        {
          family: 'StartPage',
          areaName: 'Hero',
          customerType: GeinsCustomerType.PersonType,
        },
        mockEvent,
      );

      expect(mockAreaGet).toHaveBeenCalledWith(
        {
          family: 'StartPage',
          areaName: 'Hero',
          ...channelVars,
          customerType: GeinsCustomerType.PersonType,
        },
        undefined,
      );
    });

    it('omits customerType when undefined', async () => {
      await getContentArea(
        { family: 'StartPage', areaName: 'Hero' },
        mockEvent,
      );

      expect(mockAreaGet).toHaveBeenCalledWith(
        {
          family: 'StartPage',
          areaName: 'Hero',
          ...channelVars,
        },
        undefined,
      );
    });
  });

  describe('getMenu', () => {
    it('does not accept customerType parameter', async () => {
      await getMenu({ menuLocationId: 'main' }, mockEvent);

      expect(mockMenuGet).toHaveBeenCalledWith(
        {
          menuLocationId: 'main',
          ...channelVars,
        },
        undefined,
      );
    });
  });
});

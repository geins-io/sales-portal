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

// The preview is decided on the preview token cookie, read through getCookie.
const previewToken = vi.fn<() => string | undefined>(() => undefined);
vi.stubGlobal('getCookie', (_event: unknown, name: string) =>
  name === 'cms_preview_token' ? previewToken() : undefined,
);
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal('getRequestLocale', vi.fn().mockReturnValue(undefined));
vi.stubGlobal('getRequestMarket', vi.fn().mockReturnValue(undefined));
vi.stubGlobal('getRequestHeader', vi.fn().mockReturnValue(undefined));

const { getContentArea, getPage, getMenu } =
  await import('../../../server/services/cms');

const mockEvent = {} as H3Event;

describe('CMS service customerType threading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    previewToken.mockReturnValue(undefined);
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

    it('passes customerType with the preview token, and no preview flag', async () => {
      previewToken.mockReturnValue('preview-jwt');
      await getPage(
        { alias: '/about', customerType: GeinsCustomerType.PersonType },
        mockEvent,
      );

      expect(mockPageGet).toHaveBeenCalledWith(
        {
          alias: '/about',
          ...channelVars,
          customerType: GeinsCustomerType.PersonType,
        },
        { userToken: 'preview-jwt' },
      );
    });
  });

  describe('getContentArea', () => {
    // getContentArea fetches a desktop and a mobile display-setting leg and
    // merges them, so customerType must thread through both.
    it('passes customerType to SDK when provided on both display-setting legs', async () => {
      await getContentArea(
        {
          family: 'StartPage',
          areaName: 'Hero',
          customerType: GeinsCustomerType.PersonType,
        },
        mockEvent,
      );

      for (const displaySetting of ['desktop', 'mobile'] as const) {
        expect(mockAreaGet).toHaveBeenCalledWith(
          {
            family: 'StartPage',
            areaName: 'Hero',
            ...channelVars,
            displaySetting,
            customerType: GeinsCustomerType.PersonType,
          },
          undefined,
        );
      }
    });

    it('omits customerType when undefined on both display-setting legs', async () => {
      await getContentArea(
        { family: 'StartPage', areaName: 'Hero' },
        mockEvent,
      );

      for (const displaySetting of ['desktop', 'mobile'] as const) {
        expect(mockAreaGet).toHaveBeenCalledWith(
          {
            family: 'StartPage',
            areaName: 'Hero',
            ...channelVars,
            displaySetting,
          },
          undefined,
        );
      }
    });
  });

  describe('getMenu', () => {
    it('does not accept customerType parameter', async () => {
      await getMenu({ menuLocationId: 'main' }, mockEvent);

      expect(mockMenuGet).toHaveBeenCalledWith(
        {
          menuLocationId: 'main',
          depth: 3,
          ...channelVars,
        },
        undefined,
      );
    });
  });
});

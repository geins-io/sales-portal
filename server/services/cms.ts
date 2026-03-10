import type {
  ContentPageType,
  ContentAreaType,
  MenuType,
  GeinsCustomerType,
} from '@geins/types';
import type { H3Event } from 'h3';
import { getTenantSDK, getRequestChannelVariables } from './_sdk';

export async function getMenu(
  args: { menuLocationId: string },
  event: H3Event,
): Promise<MenuType> {
  const sdk = await getTenantSDK(event);
  const channelVars = getRequestChannelVariables(sdk, event);
  return wrapServiceCall(
    () => sdk.cms.menu.get({ ...args, ...channelVars }),
    'cms',
  ) as Promise<MenuType>;
}

export async function getPage(
  args: { alias: string; customerType?: GeinsCustomerType },
  event: H3Event,
): Promise<ContentPageType> {
  const sdk = await getTenantSDK(event);
  const preview = getPreviewCookie(event);
  const channelVars = getRequestChannelVariables(sdk, event);
  return wrapServiceCall(
    () =>
      sdk.cms.page.get({
        ...args,
        ...channelVars,
        ...(preview && { preview: true }),
        ...(args.customerType && { customerType: args.customerType }),
      }) as Promise<ContentPageType>,
    'cms',
  );
}

export async function getContentArea(
  args: { family: string; areaName: string; customerType?: GeinsCustomerType },
  event: H3Event,
): Promise<ContentAreaType> {
  const sdk = await getTenantSDK(event);
  const preview = getPreviewCookie(event);
  const channelVars = getRequestChannelVariables(sdk, event);
  return wrapServiceCall(
    () =>
      sdk.cms.area.get({
        ...args,
        ...channelVars,
        ...(preview && { preview: true }),
        ...(args.customerType && { customerType: args.customerType }),
      }) as Promise<ContentAreaType>,
    'cms',
  );
}

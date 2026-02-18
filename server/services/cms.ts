import type { H3Event } from 'h3';
import { getTenantSDK } from './_sdk';

export async function getMenu(
  args: { menuLocationId: string },
  event: H3Event,
): Promise<unknown> {
  const { cms } = await getTenantSDK(event);
  return wrapServiceCall(() => cms.menu.get(args), 'cms');
}

export async function getPage(
  args: { alias: string },
  event: H3Event,
): Promise<unknown> {
  const { cms } = await getTenantSDK(event);
  const preview = getPreviewCookie(event);
  return wrapServiceCall(
    () => cms.page.get({ ...args, ...(preview && { preview: true }) }),
    'cms',
  );
}

export async function getContentArea(
  args: { family: string; areaName: string },
  event: H3Event,
): Promise<unknown> {
  const { cms } = await getTenantSDK(event);
  const preview = getPreviewCookie(event);
  return wrapServiceCall(
    () => cms.area.get({ ...args, ...(preview && { preview: true }) }),
    'cms',
  );
}

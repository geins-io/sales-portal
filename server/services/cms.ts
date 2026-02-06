import type { H3Event } from 'h3';
import { getGeinsClient } from './_client';

export async function getMenu(
  args: { menuLocationId: string },
  event: H3Event,
): Promise<unknown> {
  const { cms } = await getGeinsClient(event);
  return cms.menu.get(args);
}

export async function getPage(
  args: { alias: string },
  event: H3Event,
): Promise<unknown> {
  const { cms } = await getGeinsClient(event);
  return cms.page.get(args);
}

export async function getContentArea(
  args: { family: string; areaName: string },
  event: H3Event,
): Promise<unknown> {
  const { cms } = await getGeinsClient(event);
  return cms.area.get(args);
}

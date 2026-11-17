import type { H3Event } from 'h3';
import { stripLocaleMarketPrefix } from '#shared/utils/locale-market';
import { readPreviewPageDraft } from '../services/cms';
import { toCmsPageAlias } from './cms-page-alias';

/**
 * Where a preview lands. A page draft shows only on the URL its title gives,
 * the URL getPage matches it on, and a never-published page has no link to
 * it, so a preview sent to a start page lands there instead. Any other path,
 * a title that gives no alias, or a failed read keeps the path.
 *
 * `path` must already be a validated internal path.
 */
export async function previewLandingPath(
  event: H3Event,
  previewToken: string,
  path: string,
): Promise<string> {
  if (stripLocaleMarketPrefix(path) !== '/') return path;

  try {
    const draft = await readPreviewPageDraft(event, previewToken, path);
    const alias = toCmsPageAlias(draft?.title);
    if (!/^[a-z0-9-]+$/.test(alias)) return path;
    return `${path.replace(/\/+$/, '')}/${alias}`;
  } catch {
    return path;
  }
}

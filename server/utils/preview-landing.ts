import type { H3Event } from 'h3';
import { readPreviewPageDraft } from '../services/cms';
import { toCmsPageAlias } from './cms-page-alias';

/** The preview status page; Merchant Center links a page draft there. */
const PREVIEW_STATUS_PAGE = '/preview-widgets';

/**
 * A prefixed start page and nothing else. Under a bare `/` a two-letter alias
 * such as `/om` reads as a market prefix and is sent to the start page.
 */
const START_PAGE = /^\/[a-z]{2}\/[a-z]{2}\/*$/;

/**
 * Where a preview lands. A page draft shows only on the URL its title gives,
 * the URL getPage matches it on, and a never-published page has no link to
 * it, so a preview sent to a start page lands there instead. So does one sent
 * to the status page, under `home`, the start page that page links to. Any
 * other path, a title that gives no alias, or a failed read keeps the path.
 *
 * `path` must already be a validated internal path.
 */
export async function previewLandingPath(
  event: H3Event,
  previewToken: string,
  path: string,
  home?: string,
): Promise<string> {
  const base = START_PAGE.test(path)
    ? path
    : path === PREVIEW_STATUS_PAGE && home && START_PAGE.test(home)
      ? home
      : undefined;
  if (!base) return path;

  try {
    const draft = await readPreviewPageDraft(event, previewToken, base);
    const alias = toCmsPageAlias(draft?.title);
    if (!/^[a-z0-9-]+$/.test(alias)) return path;
    return `${base.replace(/\/+$/, '')}/${alias}`;
  } catch {
    return path;
  }
}

import { cardsRichSpacing } from '~/utils/cards-rich';

/** What a block can be at runtime: the CMS may send one without config or data. */
interface CmsBlock {
  config?: { type?: string | null } | null;
  data?: Record<string, unknown> | null;
}

const EDGE_TO_EDGE_TYPES = new Set([
  'ImagePageWidget',
  'BannerPageWidget',
  'VideoPageWidget',
]);

/** Cards Rich without space between its cards reads as one surface. */
function isJoinedCardsRich(widget: CmsBlock): boolean {
  return (
    widget.config?.type === 'JSONPageWidget' &&
    widget.data?.templateId === 'cards-rich' &&
    !cardsRichSpacing(widget.data.settings)
  );
}

/**
 * Whether a full-width container runs its blocks to the screen edge. Only when
 * every block is an image, banner, video or joined Cards Rich; any other block,
 * a mixed container included, keeps the header's gutter.
 */
export function isEdgeToEdge(widgets: readonly CmsBlock[]): boolean {
  return (
    widgets.length > 0 &&
    widgets.every(
      (widget) =>
        EDGE_TO_EDGE_TYPES.has(widget.config?.type ?? '') ||
        isJoinedCardsRich(widget),
    )
  );
}

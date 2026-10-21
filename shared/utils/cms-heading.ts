/** Widget types rendered by TextWidget.vue, whose title can be an h1. */
const TEXT_WIDGET_TYPES = new Set(['TextPageWidget', 'Rich textPageWidget']);
/** Text and HTML widgets pass their markup through v-html as authored. */
const MARKUP_FIELD: Record<string, string> = {
  TextPageWidget: 'text',
  'Rich textPageWidget': 'text',
  HTMLPageWidget: 'html',
};
const H1_TAG = /<h1[\s/>]/i;
/** TextWidget's `titleRenderMode` value for an h1. */
const TITLE_AS_H1 = 0;

interface WidgetLike {
  config?: { active?: boolean; type?: string } | null;
  data?: Record<string, unknown> | null;
}

function widgetRendersH1(widget: WidgetLike): boolean {
  if (widget.config?.active === false) return false;
  const type = widget.config?.type ?? '';
  const data = widget.data ?? {};
  if (
    TEXT_WIDGET_TYPES.has(type) &&
    data.titleRenderMode === TITLE_AS_H1 &&
    typeof data.title === 'string' &&
    data.title !== ''
  ) {
    return true;
  }
  const markup = data[MARKUP_FIELD[type] ?? ''];
  return typeof markup === 'string' && H1_TAG.test(markup);
}

/**
 * Whether a CMS area renders an h1 of its own, read from the area's data so
 * the answer is the same during SSR. Mirrors the render rules of CmsContainer
 * (inactive widgets dropped) and the text and HTML widgets. An `<h1` inside an
 * HTML comment or script in authored markup still counts.
 */
export function cmsAreaRendersH1(
  containers:
    | ReadonlyArray<{ content?: readonly WidgetLike[] | null }>
    | null
    | undefined,
): boolean {
  return (containers ?? []).some((container) =>
    (container.content ?? []).some(widgetRendersH1),
  );
}

import sanitizeHtml from 'sanitize-html';
import type {
  ContentPageType,
  ContentAreaType,
  ContentContainerType,
  ContentType,
} from '@geins/types';
import { sanitizeTenantCss } from '#shared/utils/sanitize-css';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'a',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'div',
  'span',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'blockquote',
  'figure',
  'figcaption',
  'hr',
  'sup',
  'sub',
  'small',
  'pre',
  'code',
];

const ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'title',
  'class',
  'id',
  'style',
  'width',
  'height',
  'colspan',
  'rowspan',
];

// Schemes DOMPurify allows by default, kept for parity. Relative URLs pass too.
const ALLOWED_SCHEMES = [
  'http',
  'https',
  'ftp',
  'ftps',
  'mailto',
  'tel',
  'callto',
  'sms',
  'cid',
  'xmpp',
  'matrix',
];

// Elements whose content is dropped along with the tag; any other removed
// element keeps its text. DOMPurify's FORBID_CONTENTS, plus object, whose
// fallback text must not leak through as plain text.
const DROP_CONTENT_TAGS = [
  'annotation-xml',
  'audio',
  'colgroup',
  'desc',
  'foreignobject',
  'head',
  'iframe',
  'math',
  'mi',
  'mn',
  'mo',
  'ms',
  'mtext',
  'noembed',
  'noframes',
  'noscript',
  'object',
  'plaintext',
  'script',
  'style',
  'svg',
  'template',
  'title',
  'video',
  'xmp',
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: { '*': [...ALLOWED_ATTR, 'aria-*'] },
  allowedSchemes: ALLOWED_SCHEMES,
  allowedSchemesByTag: { img: [...ALLOWED_SCHEMES, 'data'] },
  allowProtocolRelative: true,
  // Pass style through as written; CSS is not filtered here.
  parseStyleAttributes: false,
  nonTextTags: DROP_CONTENT_TAGS,
};

export function sanitizeWidgetHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

// Widget types whose `text` field TextWidget.vue renders through v-html.
const TEXT_WIDGET_TYPES = new Set(['TextPageWidget', 'Rich textPageWidget']);

function sanitizeWidgetData(widget: ContentType): ContentType {
  const type = widget.config?.type;
  const data = widget.data as Record<string, unknown>;

  if (!data || !type) return widget;

  const sanitized = { ...data };

  if (TEXT_WIDGET_TYPES.has(type) && typeof sanitized.text === 'string') {
    sanitized.text = sanitizeWidgetHtml(sanitized.text);
  }

  if (type === 'HTMLPageWidget') {
    if (typeof sanitized.html === 'string') {
      sanitized.html = sanitizeWidgetHtml(sanitized.html);
    }
    if (typeof sanitized.css === 'string') {
      sanitized.css = sanitizeTenantCss(sanitized.css);
    }
  }

  return { ...widget, data: sanitized };
}

function sanitizeContainers(
  containers: ContentContainerType[],
): ContentContainerType[] {
  return containers.map((container) => ({
    ...container,
    content: container.content?.map(sanitizeWidgetData) ?? [],
  }));
}

export function sanitizeCmsPage(page: ContentPageType): ContentPageType {
  return {
    ...page,
    containers: sanitizeContainers(page.containers ?? []),
  };
}

export function sanitizeCmsArea(area: ContentAreaType): ContentAreaType {
  return {
    ...area,
    containers: sanitizeContainers(area.containers ?? []),
  };
}

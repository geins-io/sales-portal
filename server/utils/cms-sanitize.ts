import DOMPurify from 'isomorphic-dompurify';
import type {
  ContentPageType,
  ContentAreaType,
  ContentContainerType,
  ContentType,
} from '@geins/types';
import { sanitizeTenantCss } from './sanitize';

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

export function sanitizeWidgetHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

function sanitizeWidgetData(widget: ContentType): ContentType {
  const type = widget.config?.type;
  const data = widget.data as Record<string, unknown>;

  if (!data || !type) return widget;

  const sanitized = { ...data };

  if (type === 'TextPageWidget' && typeof sanitized.text === 'string') {
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

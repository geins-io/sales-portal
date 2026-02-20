import { describe, it, expect, vi } from 'vitest';
import type {
  ContentPageType,
  ContentAreaType,
  ContentContainerType,
  ContentType,
  ContentConfigType,
} from '@geins/types';

import {
  sanitizeWidgetHtml,
  sanitizeCmsPage,
  sanitizeCmsArea,
} from '../../server/utils/cms-sanitize';

vi.mock('../../server/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createTenantLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// --- Helpers ---

function makeConfig(
  overrides: Partial<ContentConfigType> = {},
): ContentConfigType {
  return {
    name: 'w1',
    displayName: 'Widget 1',
    active: true,
    type: 'TextPageWidget',
    size: 'full',
    sortOrder: 0,
    ...overrides,
  };
}

function makeWidget(type: string, data: Record<string, unknown>): ContentType {
  return {
    config: makeConfig({ type }),
    data,
  };
}

function makeContainer(
  content: ContentType[],
  overrides: Partial<ContentContainerType> = {},
): ContentContainerType {
  return {
    id: '1',
    name: 'c1',
    sortOrder: 0,
    layout: 'full',
    responsiveMode: 'default',
    design: 'default',
    content,
    ...overrides,
  };
}

// --- Tests ---

describe('sanitizeWidgetHtml', () => {
  it('strips <script> tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script>';
    const result = sanitizeWidgetHtml(input);
    expect(result).not.toContain('<script');
    expect(result).toContain('<p>Hello</p>');
  });

  it('strips <iframe> tags', () => {
    const input = '<p>Safe</p><iframe src="https://evil.com"></iframe>';
    const result = sanitizeWidgetHtml(input);
    expect(result).not.toContain('<iframe');
    expect(result).toContain('<p>Safe</p>');
  });

  it('preserves safe HTML (p, a, strong, em, img)', () => {
    const input =
      '<p>Text <strong>bold</strong> <em>italic</em> <a href="/link">link</a> <img src="pic.jpg" alt="pic"></p>';
    const result = sanitizeWidgetHtml(input);
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<em>italic</em>');
    expect(result).toContain('<a href="/link">link</a>');
    expect(result).toContain('<img src="pic.jpg" alt="pic">');
  });

  it('strips event handlers (onclick, onerror)', () => {
    const input =
      '<p onclick="alert(1)">click</p><img src="x" onerror="alert(2)">';
    const result = sanitizeWidgetHtml(input);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onerror');
    expect(result).toContain('<p>click</p>');
  });
});

describe('sanitizeCmsPage', () => {
  it('walks containers and sanitizes TextPageWidget .text field', () => {
    const page: ContentPageType = {
      id: 'page-1',
      name: 'Test Page',
      title: 'Test',
      meta: { title: 'Test', description: '' },
      tags: [],
      containers: [
        makeContainer([
          makeWidget('TextPageWidget', {
            text: '<p>Hello</p><script>alert("xss")</script>',
            name: 'w1',
            active: true,
          }),
        ]),
      ],
    };

    const result = sanitizeCmsPage(page);
    const data = result.containers[0].content[0].data as Record<
      string,
      unknown
    >;
    expect(data.text).not.toContain('<script');
    expect(data.text).toContain('<p>Hello</p>');
  });

  it('sanitizes HTMLPageWidget .html and .css fields', () => {
    const page: ContentPageType = {
      id: 'page-2',
      name: 'HTML Page',
      title: 'HTML',
      meta: { title: 'HTML', description: '' },
      tags: [],
      containers: [
        makeContainer([
          makeWidget('HTMLPageWidget', {
            html: '<div><script>steal()</script><p>content</p></div>',
            css: 'body{color:red}<script>alert(1)</script>',
            name: 'w2',
            active: true,
          }),
        ]),
      ],
    };

    const result = sanitizeCmsPage(page);
    const data = result.containers[0].content[0].data as Record<
      string,
      unknown
    >;
    expect(data.html).not.toContain('<script');
    expect(data.html).toContain('<p>content</p>');
    expect(data.css).not.toContain('<script');
    expect(data.css).toContain('body{color:red}');
  });

  it('handles empty containers array gracefully', () => {
    const page: ContentPageType = {
      meta: { title: '', description: '' },
      tags: [],
      containers: [],
    };

    const result = sanitizeCmsPage(page);
    expect(result.containers).toEqual([]);
  });
});

describe('sanitizeCmsArea', () => {
  it('walks containers and sanitizes widget data', () => {
    const area: ContentAreaType = {
      meta: { title: 'Hero', description: '' },
      tags: [],
      containers: [
        makeContainer([
          makeWidget('TextPageWidget', {
            text: '<p>Area text</p><script>xss()</script>',
            name: 'aw1',
            active: true,
          }),
        ]),
      ],
    };

    const result = sanitizeCmsArea(area);
    const data = result.containers[0].content[0].data as Record<
      string,
      unknown
    >;
    expect(data.text).not.toContain('<script');
    expect(data.text).toContain('<p>Area text</p>');
  });

  it('handles empty containers array gracefully', () => {
    const area: ContentAreaType = {
      meta: { title: '', description: '' },
      tags: [],
      containers: [],
    };

    const result = sanitizeCmsArea(area);
    expect(result.containers).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import type { ContentType } from '#shared/types/cms';
import { isEdgeToEdge } from '../../app/utils/cms-full-width';

function widget(type: string, data: Record<string, unknown> = {}): ContentType {
  return {
    config: {
      name: 'w',
      displayName: 'Widget',
      active: true,
      type,
      size: 'full',
      sortOrder: 0,
    },
    data,
  };
}

const json = (data: Record<string, unknown>) => widget('JSONPageWidget', data);
const image = widget('ImagePageWidget');
const text = widget('TextPageWidget');
const joinedCards = json({
  templateId: 'cards-rich',
  settings: { spacing: false },
});

describe('isEdgeToEdge', () => {
  it.each(['ImagePageWidget', 'BannerPageWidget', 'VideoPageWidget'])(
    'runs a %s to the edge',
    (type) => {
      expect(isEdgeToEdge([widget(type)])).toBe(true);
    },
  );

  it.each([
    'TextPageWidget',
    'Rich textPageWidget',
    'ButtonsPageWidget',
    'Product listPageWidget',
    'HTMLPageWidget',
    'SomethingNewPageWidget',
  ])('keeps the gutter for a %s', (type) => {
    expect(isEdgeToEdge([widget(type)])).toBe(false);
  });

  it('runs a Cards Rich with spacing off to the edge', () => {
    expect(isEdgeToEdge([joinedCards])).toBe(true);
  });

  it.each([
    ['spacing on', { templateId: 'cards-rich', settings: { spacing: true } }],
    ['spacing unset', { templateId: 'cards-rich', settings: {} }],
    ['no settings (the flat shape)', { templateId: 'cards-rich', items: [] }],
    [
      'spacing off on another template',
      {
        templateId: 'cards-simple',
        settings: { spacing: false },
      },
    ],
    ['text + cta', { templateId: 'text-+-cta' }],
    ['banner cards', { templateId: 'banner-cards' }],
    ['a form', { sendFormToEmail: 'a@b.se', fields: [] }],
  ])('keeps the gutter for a JSON block with %s', (_name, data) => {
    expect(isEdgeToEdge([json(data)])).toBe(false);
  });

  it('keeps the gutter when spacing off sits on a block that is not JSON', () => {
    expect(
      isEdgeToEdge([
        widget('TextPageWidget', {
          templateId: 'cards-rich',
          settings: { spacing: false },
        }),
      ]),
    ).toBe(false);
  });

  describe('a container with several blocks', () => {
    it('runs to the edge when every block does', () => {
      expect(isEdgeToEdge([image, widget('VideoPageWidget')])).toBe(true);
      expect(isEdgeToEdge([image, joinedCards])).toBe(true);
    });

    it('keeps the gutter when any block does', () => {
      expect(isEdgeToEdge([image, text])).toBe(false);
      expect(isEdgeToEdge([text, image])).toBe(false);
      expect(isEdgeToEdge([joinedCards, text])).toBe(false);
    });
  });

  it('keeps the gutter for a block without config or data', () => {
    expect(isEdgeToEdge([{ data: {} }])).toBe(false);
    expect(isEdgeToEdge([{ config: null, data: {} }])).toBe(false);
    expect(isEdgeToEdge([{ config: { type: 'JSONPageWidget' } }])).toBe(false);
    expect(
      isEdgeToEdge([{ config: { type: 'JSONPageWidget' }, data: null }]),
    ).toBe(false);
  });

  it('keeps the gutter for an empty container', () => {
    expect(isEdgeToEdge([])).toBe(false);
  });
});

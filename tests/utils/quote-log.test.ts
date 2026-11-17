import { describe, it, expect } from 'vitest';
import {
  QUOTE_EVENT_ICONS,
  outlinedStatusClass,
} from '../../app/utils/quote-log';

describe('QUOTE_EVENT_ICONS', () => {
  it('has an icon for every event the log can show', () => {
    expect(Object.keys(QUOTE_EVENT_ICONS).sort()).toEqual(
      [
        'request_sent',
        'quote_sent',
        'revision_sent',
        'accepted',
        'confirmed',
        'declined',
        'withdrawn',
        'quote_rejected',
        'request_rejected',
        'ordered',
        'canceled',
        'expired',
        'extended',
      ].sort(),
    );
  });
});

describe('outlinedStatusClass', () => {
  it('outlines a pill so it reads on a tint', () => {
    expect(outlinedStatusClass('pending')).toEqual([
      'bg-card border-current/30',
      false,
    ]);
  });

  it('gives a solid pill its colour, as its white text would vanish', () => {
    expect(outlinedStatusClass('finalized')).toEqual([
      'bg-card border-current/30',
      'text-success',
    ]);
  });
});

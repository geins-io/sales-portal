import { describe, it, expect } from 'vitest';
import { variantSelectorMode } from '../../shared/utils/variant-selector';

describe('variantSelectorMode', () => {
  it("is today's panel grouped by dimension when the store has saved nothing", () => {
    for (const settings of [undefined, null, {}]) {
      expect(variantSelectorMode(settings), JSON.stringify(settings)).toEqual({
        display: 'panel',
        grouping: 'dimension',
      });
    }
  });

  it('falls back key by key: a null or absent key takes its default', () => {
    expect(
      variantSelectorMode({ display: 'dropdown', grouping: null }),
    ).toEqual({ display: 'dropdown', grouping: 'dimension' });
    expect(variantSelectorMode({ grouping: 'none' })).toEqual({
      display: 'panel',
      grouping: 'none',
    });
  });

  it('returns every saved pair as it is', () => {
    for (const display of ['panel', 'dropdown'] as const) {
      for (const grouping of ['dimension', 'none'] as const) {
        expect(variantSelectorMode({ display, grouping })).toEqual({
          display,
          grouping,
        });
      }
    }
  });
});

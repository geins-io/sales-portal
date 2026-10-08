import { describe, it, expect } from 'vitest';
import {
  cartLineConfiguration,
  summaryRows,
} from '../../../../server/services/line-configuration';

describe('summaryRows', () => {
  it('keeps each row as it was committed', () => {
    expect(
      summaryRows([
        { label: 'Adapter', value: 'S45' },
        { label: 'Finish', value: 'Matt' },
      ]),
    ).toEqual([
      { label: 'Adapter', value: 'S45' },
      { label: 'Finish', value: 'Matt' },
    ]);
  });

  it('reads a null label or value as empty, keeping the row', () => {
    expect(
      summaryRows([
        { label: null, value: 'S45' },
        { label: 'Finish', value: null },
      ]),
    ).toEqual([
      { label: '', value: 'S45' },
      { label: 'Finish', value: '' },
    ]);
  });
});

describe('cartLineConfiguration', () => {
  it('answers the committed id and its summary for a configured line', () => {
    expect(
      cartLineConfiguration({
        configurationId: 'committed-1',
        configuration: { summary: [{ label: 'Adapter', value: null }] },
      }),
    ).toEqual({
      configurationId: 'committed-1',
      summary: [{ label: 'Adapter', value: '' }],
    });
  });

  it('answers a line with an id and no configuration as configured, with no summary', () => {
    expect(cartLineConfiguration({ configurationId: 'committed-1' })).toEqual({
      configurationId: 'committed-1',
      summary: [],
    });
    expect(
      cartLineConfiguration({
        configurationId: 'committed-1',
        configuration: null,
      }),
    ).toEqual({ configurationId: 'committed-1', summary: [] });
  });

  it('answers nothing for a plain line', () => {
    expect(cartLineConfiguration({})).toBeUndefined();
    expect(
      cartLineConfiguration({ configurationId: null, configuration: null }),
    ).toBeUndefined();
    expect(cartLineConfiguration({ configurationId: '' })).toBeUndefined();
    expect(
      cartLineConfiguration({
        configuration: { summary: [{ label: 'Adapter', value: 'S45' }] },
      }),
    ).toBeUndefined();
  });
});

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

describe('cartLineConfiguration, the committed sections', () => {
  const PRICE = {
    sellingPriceExVat: 619.49,
    vat: 154.87,
    currency: { code: 'SEK' },
  };

  function read(sections: unknown) {
    return cartLineConfiguration({
      configurationId: 'committed-1',
      configuration: { summary: [], sections } as never,
    });
  }

  it('keeps each section with its name, index, variables, groups and nested sections', () => {
    expect(
      read([
        {
          id: 'machine',
          name: 'Machine',
          sortIndex: 2,
          variables: [
            {
              id: 'width',
              name: 'Width',
              sortIndex: 4,
              valueType: 'NUMBER',
              value: '1200.50',
              unit: 'mm',
              decimals: 1,
            },
          ],
          optionGroups: [
            {
              id: 'teeth',
              code: 'T',
              name: 'Bucket teeth',
              sortIndex: 3,
              options: [
                {
                  id: 'j250',
                  instanceId: '0',
                  articleNumber: 'J250',
                  name: 'J250 Bucket Teeth',
                  quantity: 4,
                  unitPrice: PRICE,
                  discountPercent: 0,
                },
              ],
              optionGroups: [
                {
                  id: 'edges',
                  code: 'E',
                  name: 'Edges',
                  sortIndex: 1,
                  options: [],
                },
              ],
            },
          ],
          sections: [
            {
              id: 'frame',
              name: 'Frame',
              sortIndex: null,
              variables: [],
              optionGroups: [],
            },
          ],
        },
      ])?.sections,
    ).toEqual([
      {
        name: 'Machine',
        sortIndex: 2,
        variables: [
          {
            id: 'width',
            name: 'Width',
            sortIndex: 4,
            value: 1200.5,
            unit: 'mm',
            decimals: 1,
          },
        ],
        optionGroups: [
          {
            id: 'teeth',
            name: 'Bucket teeth',
            sortIndex: 3,
            options: [
              { name: 'J250 Bucket Teeth', quantity: 4, unitPrice: PRICE },
            ],
            optionGroups: [
              {
                id: 'edges',
                name: 'Edges',
                sortIndex: 1,
                options: [],
                optionGroups: [],
              },
            ],
          },
        ],
        sections: [
          {
            name: 'Frame',
            sortIndex: null,
            variables: [],
            optionGroups: [],
            sections: [],
          },
        ],
      },
    ]);
  });

  it('reads each value by its value type', () => {
    const variable = (valueType: string, value: string | null) => ({
      id: valueType,
      name: valueType,
      sortIndex: null,
      valueType,
      value,
      unit: null,
      decimals: null,
    });
    const values = read([
      {
        id: 's',
        name: 'S',
        sortIndex: null,
        variables: [
          variable('BOOLEAN', 'true'),
          variable('STRING', 'Hall 2'),
          variable('DATE', '2026-10-05'),
          variable('NUMBER', null),
          variable('UNKNOWN', '7'),
        ],
        optionGroups: [],
        sections: [],
      },
    ])?.sections?.[0]?.variables.map((v) => v.value);

    expect(values).toEqual([true, 'Hall 2', '2026-10-05', null, '7']);
  });

  it('reads a null name or id as empty and leaves out what was not sent', () => {
    expect(
      read([
        {
          id: null,
          name: null,
          sortIndex: null,
          variables: [
            {
              id: null,
              name: null,
              sortIndex: null,
              valueType: 'STRING',
              value: 'x',
              unit: null,
              decimals: null,
            },
          ],
          optionGroups: [
            {
              id: null,
              code: null,
              name: null,
              sortIndex: null,
              options: [
                {
                  id: null,
                  instanceId: null,
                  articleNumber: null,
                  name: null,
                  quantity: null,
                  unitPrice: null,
                  discountPercent: null,
                },
              ],
            },
          ],
        },
      ])?.sections,
    ).toEqual([
      {
        name: '',
        sortIndex: null,
        variables: [{ id: '', name: '', sortIndex: null, value: 'x' }],
        optionGroups: [
          {
            id: '',
            name: '',
            sortIndex: null,
            options: [{ name: '' }],
            optionGroups: [],
          },
        ],
        sections: [],
      },
    ]);
  });

  it('keeps a decimals of 0, which is a number of digits', () => {
    const [variable] =
      read([
        {
          id: 's',
          name: 'S',
          sortIndex: null,
          variables: [
            {
              id: 'w',
              name: 'W',
              sortIndex: null,
              valueType: 'NUMBER',
              value: '12',
              unit: '',
              decimals: 0,
            },
          ],
          optionGroups: [],
          sections: [],
        },
      ])?.sections?.[0]?.variables ?? [];

    expect(variable).toEqual({
      id: 'w',
      name: 'W',
      sortIndex: null,
      value: 12,
      decimals: 0,
    });
  });

  it('keeps an empty structure, which is a recorded one', () => {
    expect(read([])).toEqual({
      configurationId: 'committed-1',
      summary: [],
      sections: [],
    });
  });

  it('leaves the sections out of a line committed before the structure was recorded', () => {
    expect(read(undefined)).toEqual({
      configurationId: 'committed-1',
      summary: [],
    });
    expect(read(null)).not.toHaveProperty('sections');
  });
});

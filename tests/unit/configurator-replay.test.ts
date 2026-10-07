import { describe, it, expect } from 'vitest';
import type {
  Configuration,
  ConfigurationOption,
  ConfigurationOptionGroup,
  ConfigurationSection,
  ConfigurationVariable,
} from '../../shared/types/configurator';
import {
  choicesOf,
  replayLineHref,
  replayTarget,
  withoutReplay,
} from '../../app/utils/configurator-replay';

const ORDER_ID = '6f1c2a9e-0b8d-4e3f-9a51-2c7d8e4b1f03';

describe('replayLineHref', () => {
  it('puts the order and the row position on the product path, as ids only', () => {
    expect(
      replayLineHref('/se/sv/p/digging-bucket', {
        publicOrderId: ORDER_ID,
        row: 2,
      }),
    ).toBe(`/se/sv/p/digging-bucket?order=${ORDER_ID}&row=2`);
  });
});

describe('replayTarget', () => {
  it('names the order row the query points at', () => {
    expect(replayTarget({ order: ORDER_ID, row: '0' })).toEqual({
      row: { publicOrderId: ORDER_ID, row: 0 },
      stale: false,
    });
    expect(
      replayTarget({ order: ORDER_ID.toUpperCase(), row: '12' }).row,
    ).toEqual({ publicOrderId: ORDER_ID.toUpperCase(), row: 12 });
  });

  it('names nothing on an ordinary product page', () => {
    expect(replayTarget({})).toEqual({ row: null, stale: false });
    expect(replayTarget({ cart: 'cart-1', line: 'item-1' })).toEqual({
      row: null,
      stale: false,
    });
  });

  it.each([
    ['an order without a row', { order: ORDER_ID }],
    ['a row without an order', { row: '1' }],
    ['an order that is not a GUID', { order: 'order-1', row: '1' }],
    ['a GUID with something after it', { order: `${ORDER_ID}x`, row: '1' }],
    ['a GUID with something before it', { order: `x${ORDER_ID}`, row: '1' }],
    ['a negative row', { order: ORDER_ID, row: '-1' }],
    ['a fractional row', { order: ORDER_ID, row: '1.5' }],
    ['a row that is not a number', { order: ORDER_ID, row: 'one' }],
    ['an empty row', { order: ORDER_ID, row: '' }],
    ['a row with a number in it', { order: ORDER_ID, row: '1a' }],
    ['repeated ids', { order: [ORDER_ID, ORDER_ID], row: '1' }],
    ['an order id in a list', { order: [ORDER_ID], row: '1' }],
    ['a row in a list', { order: ORDER_ID, row: ['1'] }],
  ])('reads %s as a link the page cannot replay', (_case, query) => {
    expect(replayTarget(query)).toEqual({ row: null, stale: true });
  });
});

describe('withoutReplay', () => {
  it('drops the order row and keeps the rest of the query', () => {
    expect(
      withoutReplay({ order: ORDER_ID, row: '1', utm_source: 'mail' }),
    ).toEqual({ utm_source: 'mail' });
  });
});

function variable(
  id: string,
  value: ConfigurationVariable['value'],
): ConfigurationVariable {
  return {
    id,
    name: id,
    description: '',
    valueType: 'number',
    value,
    defaultValue: null,
    required: false,
    available: true,
    readOnly: false,
    selectionSource: 'none',
    valueSource: 'manual',
    messages: [],
  };
}

function option(
  id: string,
  selected: boolean,
  over: Partial<ConfigurationOption> = {},
): ConfigurationOption {
  return {
    id,
    instanceId: '0',
    articleNumber: id,
    name: id,
    description: '',
    selected,
    available: true,
    readOnly: false,
    selectionSource: 'none',
    quantity: 1,
    defaultQuantity: 1,
    unitPrice: {},
    discountPercent: 0,
    messages: [],
    product: null,
    ...over,
  };
}

function group(
  id: string,
  options: ConfigurationOption[],
  optionGroups: ConfigurationOptionGroup[] = [],
): ConfigurationOptionGroup {
  return {
    id,
    code: id,
    name: id,
    description: '',
    available: true,
    quantityEditable: true,
    optionGroups,
    options,
    messages: [],
  };
}

function section(
  id: string,
  parts: Partial<ConfigurationSection> = {},
): ConfigurationSection {
  return {
    id,
    name: id,
    description: '',
    visible: true,
    sections: [],
    variables: [],
    optionGroups: [],
    messages: [],
    ...parts,
  };
}

function document(sections: ConfigurationSection[]): Configuration {
  return {
    configurationId: 'session-1',
    expiresAt: '2030-01-01T00:00:00.000Z',
    isValid: true,
    articleNumber: 'M-1',
    quantity: 2,
    unitPrice: {},
    discountPercent: 0,
    templateId: 't',
    templateVersion: '1',
    messages: [],
    sections,
  };
}

describe('choicesOf', () => {
  it('takes every variable with a value and every selected option, nested ones included', () => {
    const config = document([
      section('machine', {
        variables: [variable('width', 1200), variable('note', null)],
        optionGroups: [
          group(
            'adapters',
            [
              option('adapter', true),
              option('spare', false),
              option('clamp', true, { instanceId: '3', quantity: 4 }),
            ],
            [group('edges', [option('trim', true, { instanceId: '2' })])],
          ),
        ],
        sections: [
          section('frame', {
            variables: [
              variable('depth', 600),
              variable('painted', false),
              variable('label', ''),
            ],
            optionGroups: [group('finish', [option('matt', true)])],
          }),
        ],
      }),
    ]);

    expect(choicesOf(config)).toEqual({
      variables: [
        { id: 'width', value: 1200 },
        { id: 'depth', value: 600 },
        { id: 'painted', value: false },
        { id: 'label', value: '' },
      ],
      options: [
        { id: 'adapter', instanceId: '0', quantity: 1 },
        { id: 'clamp', instanceId: '3', quantity: 4 },
        { id: 'trim', instanceId: '2', quantity: 1 },
        { id: 'matt', instanceId: '0', quantity: 1 },
      ],
    });
  });

  it('takes nothing from a document with no choices', () => {
    expect(
      choicesOf(
        document([
          section('machine', {
            variables: [variable('width', null)],
            optionGroups: [group('adapters', [option('adapter', false)])],
          }),
        ]),
      ),
    ).toEqual({ variables: [], options: [] });
  });
});

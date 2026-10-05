import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAppError, ErrorCode } from '../../../../server/utils/errors';
import { logger } from '../../../../server/utils/logger';
import type { ConfiguratorContext } from '../../../../server/services/configurator';
import { createMerchantApiConfiguratorBackend } from '../../../../server/services/configurator-merchant-api';
import { toWireChange } from '../../../../server/services/configurator-merchant-api/changes';
import {
  mapCommittedConfiguration,
  mapConfiguration,
} from '../../../../server/services/configurator-merchant-api/map';
import type {
  WireCommittedConfiguration,
  WireConfiguration,
  WireOption,
  WireOptionGroup,
  WireSection,
  WireVariable,
} from '../../../../server/services/configurator-merchant-api/wire';
import { loadQuery } from '../../../../server/services/graphql/loader';

// ---------------------------------------------------------------------------
// The merchant-api backend: the CPQ area over GraphQL.
//
// Every response below is hand-written in the shape the canary's schema
// declares (introspected 2026-09-24): upper-case enums, nullable ids, Decimal
// scalars, Geins PriceType. None is a copy of a recorded response.
// ---------------------------------------------------------------------------

vi.stubGlobal('createAppError', createAppError);
vi.stubGlobal('ErrorCode', ErrorCode);

const URL = 'https://cpq-canary.example.test/graphql';
const API_KEY = 'secret-api-key-123';

const CTX: ConfiguratorContext = {
  hostname: 'tenant.example.com',
  userToken: 'user-token-1',
  merchantApi: {
    url: URL,
    apiKey: API_KEY,
    channelId: '1|se',
    languageId: 'sv-SE',
    marketId: 'SE|SEK',
  },
};

const PRICE = {
  sellingPriceExVat: 50.25,
  sellingPriceIncVat: 62.81,
  regularPriceExVat: 67,
  regularPriceIncVat: 83.75,
  vat: 12.56,
  isDiscounted: true,
  discountPercentage: 25,
  currency: { code: 'SEK', symbol: 'kr' },
};

function wireOption(over: Partial<WireOption> = {}): WireOption {
  return {
    id: 'opt-1',
    instanceId: '0',
    articleNumber: '100004',
    name: 'Tooth set',
    description: '',
    selected: false,
    available: true,
    readOnly: false,
    selectionSource: 'NONE',
    quantity: 1,
    defaultQuantity: 1,
    minQuantity: null,
    maxQuantity: null,
    unitPrice: PRICE,
    discountPercent: 25,
    product: null,
    messages: [],
    ...over,
  };
}

function wireGroup(over: Partial<WireOptionGroup> = {}): WireOptionGroup {
  return {
    id: 'grp-1',
    code: 'TEETH',
    name: 'Teeth',
    description: '',
    available: true,
    minSelections: 1,
    maxSelections: 1,
    minQuantity: null,
    maxQuantity: null,
    quantityEditable: false,
    sortIndex: 4,
    optionGroups: [],
    options: [wireOption()],
    messages: [],
    ...over,
  };
}

function wireVariable(over: Partial<WireVariable> = {}): WireVariable {
  return {
    id: 'var-1',
    name: 'Width',
    description: '',
    valueType: 'NUMBER',
    value: 1200,
    defaultValue: 1000,
    required: true,
    available: true,
    readOnly: false,
    min: 800,
    max: 2000,
    step: 10,
    decimals: 0,
    unit: 'mm',
    selectionSource: 'MANUAL',
    valueSource: 'MANUAL',
    sortIndex: 3,
    messages: [],
    ...over,
  };
}

function wireSection(over: Partial<WireSection> = {}): WireSection {
  return {
    id: 'sec-1',
    name: 'Machine',
    description: '',
    visible: true,
    sortIndex: 2,
    sections: [],
    variables: [wireVariable()],
    optionGroups: [wireGroup()],
    messages: [],
    ...over,
  };
}

function wireConfiguration(
  over: Partial<WireConfiguration> = {},
): WireConfiguration {
  return {
    configurationId: 'cfg-1',
    expiresAt: '2026-09-24T15:00:00+00:00',
    isValid: false,
    articleNumber: '001-2',
    quantity: 1,
    unitPrice: PRICE,
    discountPercent: 0,
    weightPerUnit: 812.5,
    templateId: 'TPL-1',
    templateVersion: '7',
    messages: [],
    sections: [wireSection()],
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

describe('mapConfiguration', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('maps the document fields', () => {
    const config = mapConfiguration(wireConfiguration());

    expect(config).toMatchObject({
      configurationId: 'cfg-1',
      expiresAt: '2026-09-24T15:00:00+00:00',
      isValid: false,
      articleNumber: '001-2',
      quantity: 1,
      unitPrice: PRICE,
      discountPercent: 0,
      weightPerUnit: 812.5,
      templateId: 'TPL-1',
      templateVersion: '7',
      messages: [],
    });
  });

  it('reads a Decimal sent as a string as a number', () => {
    const config = mapConfiguration(
      wireConfiguration({
        quantity: '2',
        discountPercent: '12.5',
        weightPerUnit: '10.25',
        sections: [
          wireSection({
            variables: [
              wireVariable({ min: '1.5', max: '9', step: '0.5', value: '3.5' }),
            ],
            optionGroups: [
              wireGroup({
                minQuantity: '1',
                maxQuantity: '4',
                options: [
                  wireOption({
                    quantity: '2',
                    defaultQuantity: '1',
                    minQuantity: '0',
                    maxQuantity: '5',
                    discountPercent: '10',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    );

    expect(config.quantity).toBe(2);
    expect(config.discountPercent).toBe(12.5);
    expect(config.weightPerUnit).toBe(10.25);
    const variable = config.sections[0]!.variables[0]!;
    expect(variable).toMatchObject({ min: 1.5, max: 9, step: 0.5, value: 3.5 });
    const group = config.sections[0]!.optionGroups[0]!;
    expect(group).toMatchObject({ minQuantity: 1, maxQuantity: 4 });
    expect(group.options[0]).toMatchObject({
      quantity: 2,
      defaultQuantity: 1,
      minQuantity: 0,
      maxQuantity: 5,
      discountPercent: 10,
    });
  });

  it('fills the nullable text and number fields with their resting values', () => {
    const config = mapConfiguration(
      wireConfiguration({
        articleNumber: null,
        discountPercent: null,
        weightPerUnit: null,
        templateId: null,
        templateVersion: null,
        messages: null,
        sections: [
          wireSection({
            name: null,
            description: null,
            sortIndex: null,
            sections: null,
            messages: null,
            variables: [
              wireVariable({
                name: null,
                description: null,
                min: null,
                max: null,
                step: null,
                decimals: null,
                unit: null,
                messages: null,
              }),
            ],
            optionGroups: [
              wireGroup({
                code: null,
                name: null,
                description: null,
                minSelections: null,
                maxSelections: null,
                optionGroups: null,
                messages: null,
                options: [
                  wireOption({
                    instanceId: null,
                    articleNumber: null,
                    name: null,
                    description: null,
                    discountPercent: null,
                    messages: null,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    );

    expect(config.articleNumber).toBe('');
    expect(config.discountPercent).toBe(0);
    expect('weightPerUnit' in config).toBe(false);
    expect(config.templateId).toBe('');
    expect(config.templateVersion).toBe('');
    expect(config.messages).toEqual([]);

    const section = config.sections[0]!;
    expect(section).toMatchObject({
      name: '',
      description: '',
      sortIndex: null,
      sections: [],
      messages: [],
    });

    const variable = section.variables[0]!;
    expect(variable).toMatchObject({ name: '', description: '', messages: [] });
    for (const key of ['min', 'max', 'step', 'decimals', 'unit']) {
      expect(key in variable, key).toBe(false);
    }

    const group = section.optionGroups[0]!;
    expect(group).toMatchObject({
      code: '',
      name: '',
      description: '',
      optionGroups: [],
      messages: [],
    });
    expect('minSelections' in group).toBe(false);
    expect('maxSelections' in group).toBe(false);

    expect(group.options[0]).toMatchObject({
      instanceId: '',
      articleNumber: '',
      name: '',
      description: '',
      discountPercent: 0,
      messages: [],
    });
  });

  it('keeps an empty list where the wire sends none', () => {
    const config = mapConfiguration(
      wireConfiguration({
        sections: [wireSection({ variables: null, optionGroups: null })],
      }),
    );
    expect(config.sections[0]).toMatchObject({
      variables: [],
      optionGroups: [],
    });
    expect(
      mapConfiguration(wireConfiguration({ sections: null })).sections,
    ).toEqual([]);
  });

  it('carries the node fields through', () => {
    const config = mapConfiguration(wireConfiguration());
    const section = config.sections[0]!;

    expect(section).toMatchObject({
      id: 'sec-1',
      name: 'Machine',
      visible: true,
      sortIndex: 2,
    });
    expect(section.variables[0]).toMatchObject({
      id: 'var-1',
      name: 'Width',
      valueType: 'number',
      value: 1200,
      defaultValue: 1000,
      required: true,
      available: true,
      readOnly: false,
      min: 800,
      max: 2000,
      step: 10,
      decimals: 0,
      unit: 'mm',
      selectionSource: 'manual',
      valueSource: 'manual',
      sortIndex: 3,
    });
    expect(section.optionGroups[0]).toMatchObject({
      id: 'grp-1',
      code: 'TEETH',
      name: 'Teeth',
      available: true,
      minSelections: 1,
      maxSelections: 1,
      quantityEditable: false,
      sortIndex: 4,
    });
    expect(section.optionGroups[0]!.options[0]).toMatchObject({
      id: 'opt-1',
      instanceId: '0',
      articleNumber: '100004',
      name: 'Tooth set',
      selected: false,
      available: true,
      readOnly: false,
      selectionSource: 'none',
      quantity: 1,
      defaultQuantity: 1,
      unitPrice: PRICE,
      discountPercent: 25,
      product: null,
    });
  });

  it('maps nested sections and nested groups', () => {
    const config = mapConfiguration(
      wireConfiguration({
        sections: [
          wireSection({
            sections: [
              wireSection({
                id: 'sec-child',
                optionGroups: [
                  wireGroup({
                    optionGroups: [wireGroup({ id: 'grp-child' })],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    );

    const child = config.sections[0]!.sections[0]!;
    expect(child.id).toBe('sec-child');
    expect(child.optionGroups[0]!.optionGroups[0]!.id).toBe('grp-child');
  });

  describe('selection source', () => {
    it.each([
      ['NONE', 'none'],
      ['INITIAL', 'initial'],
      ['MANUAL', 'manual'],
      ['RULE_SELECTED', 'ruleSelected'],
      ['RULE_DESELECTED', 'ruleDeselected'],
      ['GROUP_RULE', 'groupRule'],
      ['LOCKED', 'locked'],
      ['TEMPORARILY_LOCKED', 'temporarilyLocked'],
      ['UNKNOWN', 'unknown'],
    ])('maps %s to %s on options and variables', (wire, ours) => {
      const config = mapConfiguration(
        wireConfiguration({
          sections: [
            wireSection({
              variables: [wireVariable({ selectionSource: wire })],
              optionGroups: [
                wireGroup({ options: [wireOption({ selectionSource: wire })] }),
              ],
            }),
          ],
        }),
      );
      const section = config.sections[0]!;
      expect(section.variables[0]!.selectionSource).toBe(ours);
      expect(section.variables[0]!.selectionSourceRaw).toBeUndefined();
      expect(section.optionGroups[0]!.options[0]!.selectionSource).toBe(ours);
      expect(
        section.optionGroups[0]!.options[0]!.selectionSourceRaw,
      ).toBeUndefined();
    });

    it('keeps a value it does not know as unknown, with the raw value beside it', () => {
      const config = mapConfiguration(
        wireConfiguration({
          sections: [
            wireSection({
              variables: [wireVariable({ selectionSource: 'SOMETHING_NEW' })],
              optionGroups: [
                wireGroup({
                  options: [wireOption({ selectionSource: 'SOMETHING_NEW' })],
                }),
              ],
            }),
          ],
        }),
      );
      const section = config.sections[0]!;
      expect(section.variables[0]).toMatchObject({
        selectionSource: 'unknown',
        selectionSourceRaw: 'SOMETHING_NEW',
      });
      expect(section.optionGroups[0]!.options[0]).toMatchObject({
        selectionSource: 'unknown',
        selectionSourceRaw: 'SOMETHING_NEW',
      });
    });
  });

  describe('value source', () => {
    it.each([
      ['INITIAL', 'initial'],
      ['MANUAL', 'manual'],
      ['FORMULA', 'formula'],
      ['LINKED', 'linked'],
      ['FALLBACK', 'fallback'],
      ['UNKNOWN', 'unknown'],
    ])('maps %s to %s', (wire, ours) => {
      const config = mapConfiguration(
        wireConfiguration({
          sections: [
            wireSection({ variables: [wireVariable({ valueSource: wire })] }),
          ],
        }),
      );
      expect(config.sections[0]!.variables[0]!.valueSource).toBe(ours);
      expect(config.sections[0]!.variables[0]!.valueSourceRaw).toBeUndefined();
    });

    it('keeps a value it does not know as unknown, with the raw value beside it', () => {
      const config = mapConfiguration(
        wireConfiguration({
          sections: [
            wireSection({
              variables: [wireVariable({ valueSource: 'SOMETHING_NEW' })],
            }),
          ],
        }),
      );
      expect(config.sections[0]!.variables[0]).toMatchObject({
        valueSource: 'unknown',
        valueSourceRaw: 'SOMETHING_NEW',
      });
    });
  });

  describe('value type and value', () => {
    function variableOf(over: Partial<WireVariable>) {
      return mapConfiguration(
        wireConfiguration({
          sections: [wireSection({ variables: [wireVariable(over)] })],
        }),
      ).sections[0]!.variables[0]!;
    }

    it('reads a number, sent as a number or as a string', () => {
      expect(variableOf({ valueType: 'NUMBER', value: 12.5 })).toMatchObject({
        valueType: 'number',
        value: 12.5,
      });
      expect(
        variableOf({ valueType: 'NUMBER', value: '12.5', defaultValue: '3' }),
      ).toMatchObject({ value: 12.5, defaultValue: 3 });
    });

    it('reads a string', () => {
      expect(variableOf({ valueType: 'STRING', value: 'abc' })).toMatchObject({
        valueType: 'string',
        value: 'abc',
      });
      expect(warn).not.toHaveBeenCalled();
    });

    it('reads a boolean, sent as a boolean or as a string', () => {
      expect(variableOf({ valueType: 'BOOLEAN', value: true })).toMatchObject({
        valueType: 'boolean',
        value: true,
      });
      expect(
        variableOf({
          valueType: 'BOOLEAN',
          value: 'false',
          defaultValue: 'true',
        }),
      ).toMatchObject({ value: false, defaultValue: true });
    });

    it('keeps a boolean that does not read as one as unset', () => {
      expect(variableOf({ valueType: 'BOOLEAN', value: 'yes' }).value).toBe(
        null,
      );
    });

    it('reads a date as its ISO string', () => {
      expect(
        variableOf({ valueType: 'DATE', value: '2026-10-01' }),
      ).toMatchObject({ valueType: 'date', value: '2026-10-01' });
    });

    it('keeps an unset value as null, whatever the type', () => {
      for (const valueType of ['NUMBER', 'STRING', 'BOOLEAN', 'DATE']) {
        expect(
          variableOf({ valueType, value: null, defaultValue: null }),
          valueType,
        ).toMatchObject({ value: null, defaultValue: null });
      }
    });

    it('keeps a number that does not parse as unset rather than NaN', () => {
      expect(variableOf({ valueType: 'NUMBER', value: 'abc' }).value).toBe(
        null,
      );
    });

    it('keeps a boolean sent for a number as unset rather than 1', () => {
      expect(variableOf({ valueType: 'NUMBER', value: true }).value).toBe(null);
    });

    it('renders an UNKNOWN type as a string field and says so', () => {
      const variable = variableOf({ valueType: 'UNKNOWN', value: 'x' });

      expect(variable).toMatchObject({ valueType: 'string', value: 'x' });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]![0])).toContain('Width');
    });
  });

  describe('messages', () => {
    it('keeps errors and warnings, lower-cased', () => {
      const config = mapConfiguration(
        wireConfiguration({
          messages: [
            { severity: 'ERROR', text: 'e' },
            { severity: 'WARNING', text: 'w' },
          ],
        }),
      );
      expect(config.messages).toEqual([
        { severity: 'error', text: 'e' },
        { severity: 'warning', text: 'w' },
      ]);
    });

    it('keeps INFO as info', () => {
      const config = mapConfiguration(
        wireConfiguration({ messages: [{ severity: 'INFO', text: 'i' }] }),
      );
      expect(config.messages).toEqual([{ severity: 'info', text: 'i' }]);
    });

    it('drops UNKNOWN and any severity it does not know', () => {
      const config = mapConfiguration(
        wireConfiguration({
          messages: [
            { severity: 'UNKNOWN', text: 'u' },
            { severity: 'NOTICE', text: 'n' },
            { severity: 'ERROR', text: 'e' },
          ],
        }),
      );
      expect(config.messages).toEqual([{ severity: 'error', text: 'e' }]);
    });

    it('reads a missing text as empty and skips a null entry', () => {
      const config = mapConfiguration(
        wireConfiguration({
          messages: [null, { severity: 'WARNING', text: null }],
        }),
      );
      expect(config.messages).toEqual([{ severity: 'warning', text: '' }]);
    });

    it('maps the messages on every node kind', () => {
      const messages = [{ severity: 'ERROR', text: 'x' }];
      const config = mapConfiguration(
        wireConfiguration({
          sections: [
            wireSection({
              messages,
              variables: [wireVariable({ messages })],
              optionGroups: [
                wireGroup({ messages, options: [wireOption({ messages })] }),
              ],
            }),
          ],
        }),
      );
      const section = config.sections[0]!;
      const expected = [{ severity: 'error', text: 'x' }];
      expect(section.messages).toEqual(expected);
      expect(section.variables[0]!.messages).toEqual(expected);
      expect(section.optionGroups[0]!.messages).toEqual(expected);
      expect(section.optionGroups[0]!.options[0]!.messages).toEqual(expected);
    });
  });

  describe('prices', () => {
    it('passes the Geins price through as it is sent', () => {
      const config = mapConfiguration(wireConfiguration());
      expect(config.unitPrice).toEqual(PRICE);
      expect(
        config.sections[0]!.optionGroups[0]!.options[0]!.unitPrice,
      ).toEqual(PRICE);
    });

    it('carries a missing price as an empty one, never as invented numbers', () => {
      const config = mapConfiguration(
        wireConfiguration({
          unitPrice: null,
          sections: [
            wireSection({
              optionGroups: [
                wireGroup({ options: [wireOption({ unitPrice: null })] }),
              ],
            }),
          ],
        }),
      );
      expect(config.unitPrice).toEqual({});
      expect(
        config.sections[0]!.optionGroups[0]!.options[0]!.unitPrice,
      ).toEqual({});
    });
  });

  describe('the embedded product', () => {
    it('keeps a missing product as null', () => {
      const config = mapConfiguration(wireConfiguration());
      expect(
        config.sections[0]!.optionGroups[0]!.options[0]!.product,
      ).toBeNull();
    });

    it('passes a present product through', () => {
      const product = { productId: 42, name: 'Tooth', alias: 'tooth' };
      const config = mapConfiguration(
        wireConfiguration({
          sections: [
            wireSection({
              optionGroups: [
                wireGroup({
                  options: [
                    wireOption({
                      product: product as unknown as WireOption['product'],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      );
      expect(config.sections[0]!.optionGroups[0]!.options[0]!.product).toBe(
        product,
      );
    });
  });

  describe('a node without an id', () => {
    it('drops a section and its subtree, keeping its siblings', () => {
      const config = mapConfiguration(
        wireConfiguration({
          sections: [
            wireSection({ id: null, name: 'Hidden base' }),
            wireSection({ id: 'sec-2' }),
          ],
        }),
      );

      expect(config.sections.map((s) => s.id)).toEqual(['sec-2']);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]![0])).toContain('section');
      expect(String(warn.mock.calls[0]![0])).toContain('Hidden base');
    });

    it('drops a variable', () => {
      const config = mapConfiguration(
        wireConfiguration({
          sections: [
            wireSection({
              variables: [
                wireVariable({ id: null, name: 'Depth' }),
                wireVariable({ id: 'var-2' }),
              ],
            }),
          ],
        }),
      );
      expect(config.sections[0]!.variables.map((v) => v.id)).toEqual(['var-2']);
      expect(String(warn.mock.calls[0]![0])).toContain('variable');
      expect(String(warn.mock.calls[0]![0])).toContain('Depth');
    });

    it('drops an option group, nested or not', () => {
      const config = mapConfiguration(
        wireConfiguration({
          sections: [
            wireSection({
              optionGroups: [
                wireGroup({ id: null, name: 'Loose' }),
                wireGroup({
                  id: 'grp-2',
                  optionGroups: [wireGroup({ id: null, name: 'Inner' })],
                }),
              ],
            }),
          ],
        }),
      );
      const groups = config.sections[0]!.optionGroups;
      expect(groups.map((g) => g.id)).toEqual(['grp-2']);
      expect(groups[0]!.optionGroups).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(2);
      expect(String(warn.mock.calls[0]![0])).toContain('option group');
      expect(String(warn.mock.calls[0]![0])).toContain('Loose');
    });

    it('drops an option', () => {
      const config = mapConfiguration(
        wireConfiguration({
          sections: [
            wireSection({
              optionGroups: [
                wireGroup({
                  options: [
                    wireOption({ id: null, name: 'Nameless part' }),
                    wireOption({ id: 'opt-2' }),
                  ],
                }),
              ],
            }),
          ],
        }),
      );
      expect(
        config.sections[0]!.optionGroups[0]!.options.map((o) => o.id),
      ).toEqual(['opt-2']);
      expect(String(warn.mock.calls[0]![0])).toContain('option');
      expect(String(warn.mock.calls[0]![0])).toContain('Nameless part');
    });

    it('names a node that has neither id nor name as such', () => {
      mapConfiguration(
        wireConfiguration({
          sections: [wireSection({ id: null, name: null })],
        }),
      );
      expect(String(warn.mock.calls[0]![0])).toContain('(no name)');
    });

    it('skips a null entry in a list without a warning', () => {
      const config = mapConfiguration(
        wireConfiguration({
          sections: [
            null,
            wireSection({
              variables: [null],
              optionGroups: [
                wireGroup({ options: [null], optionGroups: [null] }),
              ],
              sections: [null],
            }),
          ],
        }),
      );
      const section = config.sections[0]!;
      expect(config.sections).toHaveLength(1);
      expect(section.variables).toEqual([]);
      expect(section.sections).toEqual([]);
      expect(section.optionGroups[0]!.options).toEqual([]);
      expect(section.optionGroups[0]!.optionGroups).toEqual([]);
      expect(warn).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// The change batch, as the canary's input type declares it
// ---------------------------------------------------------------------------

describe('toWireChange', () => {
  it('sends a variable change with its value as it is', () => {
    // 1359's "Machine weight (7–20)", a NUMBER.
    expect(
      toWireChange({ type: 'variable', variableId: 'MW', value: 12 }),
    ).toEqual({ type: 'VARIABLE', variableId: 'MW', value: 12 });
  });

  it.each([
    ['a string', 'RAL 9005'],
    ['a boolean', true],
    ['a date', '2026-10-01'],
    ['an unset value', null],
  ])('passes %s through as the CpqValue', (_label, value) => {
    expect(toWireChange({ type: 'variable', variableId: 'V', value })).toEqual({
      type: 'VARIABLE',
      variableId: 'V',
      value,
    });
  });

  it('sends an option change with the selection and the lock in one', () => {
    // A select and a lock travel in one change (transcript step 6b).
    expect(
      toWireChange({
        type: 'option',
        optionId: '100004',
        instanceId: '0',
        selected: true,
        quantity: 1,
        lock: 'lock',
      }),
    ).toEqual({
      type: 'OPTION',
      optionId: '100004',
      instanceId: '0',
      selected: true,
      quantity: 1,
      lock: 'LOCK',
    });
  });

  it.each([
    ['none', 'NONE'],
    ['lock', 'LOCK'],
    ['unlock', 'UNLOCK'],
  ] as const)('sends the lock %s as %s', (lock, wire) => {
    const change = toWireChange({
      type: 'option',
      optionId: 'o',
      instanceId: '1',
      selected: false,
      quantity: 0,
      lock,
    });
    expect(change).toMatchObject({ type: 'OPTION', lock: wire });
  });

  it("sends the configuration's own quantity", () => {
    expect(toWireChange({ type: 'quantity', quantity: 3 })).toEqual({
      type: 'QUANTITY',
      quantity: 3,
    });
  });
});

// ---------------------------------------------------------------------------
// The committed configuration, as `CpqCommittedConfigurationType` declares it
// ---------------------------------------------------------------------------

function wireCommitted(
  over: Partial<WireCommittedConfiguration> = {},
): WireCommittedConfiguration {
  return {
    committedConfigurationId: 'committed-1',
    configurationId: 'cfg-1',
    articleNumber: '001-2',
    quantity: 1,
    unitPrice: PRICE,
    discountPercent: 25,
    weightPerUnit: 12.5,
    summary: [
      { label: 'Machine weight (7-20)', value: '12' },
      { label: 'Adapter', value: 'S50' },
    ],
    ...over,
  };
}

describe('mapCommittedConfiguration', () => {
  it('maps the record the commit froze', () => {
    expect(mapCommittedConfiguration(wireCommitted(), 'cfg-1')).toEqual({
      committedConfigurationId: 'committed-1',
      configurationId: 'cfg-1',
      articleNumber: '001-2',
      quantity: 1,
      unitPrice: PRICE,
      discountPercent: 25,
      weightPerUnit: 12.5,
      summary: [
        { label: 'Machine weight (7-20)', value: '12' },
        { label: 'Adapter', value: 'S50' },
      ],
    });
  });

  it('reads a Decimal discount and weight sent as strings', () => {
    const committed = mapCommittedConfiguration(
      wireCommitted({ discountPercent: '7.5', weightPerUnit: '38.25' }),
      'cfg-1',
    );
    expect(committed.discountPercent).toBe(7.5);
    expect(committed.weightPerUnit).toBe(38.25);
  });

  it('keeps the summary in the order it was sent', () => {
    const summary = [
      { label: 'b', value: '2' },
      { label: 'a', value: '1' },
      { label: 'c', value: '3' },
    ];
    expect(
      mapCommittedConfiguration(wireCommitted({ summary }), 'cfg-1').summary,
    ).toEqual(summary);
  });

  it('reads a Decimal quantity sent as a string', () => {
    expect(
      mapCommittedConfiguration(wireCommitted({ quantity: '2' }), 'cfg-1')
        .quantity,
    ).toBe(2);
  });

  it('fills the nullable fields with their resting values', () => {
    const committed = mapCommittedConfiguration(
      wireCommitted({
        configurationId: null,
        articleNumber: null,
        unitPrice: null,
        discountPercent: null,
        weightPerUnit: null,
        summary: [null, { label: null, value: null }],
      }),
      'cfg-asked',
    );
    expect(committed.discountPercent).toBe(0);
    expect(committed).not.toHaveProperty('weightPerUnit');
    expect(committed.configurationId).toBe('cfg-asked');
    expect(committed.articleNumber).toBe('');
    expect(committed.unitPrice).toEqual(
      mapConfiguration(wireConfiguration({ unitPrice: null })).unitPrice,
    );
    expect(committed.summary).toEqual([{ label: '', value: '' }]);
  });

  it('keeps an absent summary as an empty one', () => {
    expect(
      mapCommittedConfiguration(wireCommitted({ summary: null }), 'cfg-1')
        .summary,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The backend over the wire
// ---------------------------------------------------------------------------

function answer(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function graphqlError(code: string) {
  return answer({
    data: null,
    errors: [{ message: `failed: ${code}`, extensions: { code } }],
  });
}

async function failureOf(call: () => Promise<unknown>) {
  try {
    await call();
  } catch (error) {
    return error as {
      statusCode?: number;
      message?: string;
      statusMessage?: string;
      data?: unknown;
      cause?: unknown;
    };
  }
  throw new Error('expected the call to fail');
}

describe('the merchant-api backend', () => {
  const fetchMock = vi.fn();
  let backend: ReturnType<typeof createMerchantApiConfiguratorBackend>;
  const logSpies: ReturnType<typeof vi.spyOn>[] = [];

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    backend = createMerchantApiConfiguratorBackend();
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      logSpies.push(vi.spyOn(logger, level).mockImplementation(() => {}));
    }
  });

  afterEach(() => {
    for (const spy of logSpies.splice(0)) spy.mockRestore();
  });

  function sentRequest(call = 0) {
    const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
    return {
      url,
      init,
      headers: init.headers as Record<string, string>,
      body: JSON.parse(String(init.body)) as {
        query: string;
        variables: Record<string, unknown>;
      },
    };
  }

  describe('isConfigurable', () => {
    it('says yes for the type the Monitor sync stamps', () => {
      expect(
        backend.isConfigurable(
          { productId: '1359', type: 'configurable' },
          CTX,
        ),
      ).toBe(true);
    });

    it.each([
      ['an ordinary product', 'product'],
      ['no type', undefined],
      ['a null type', null],
    ])('says no for %s', (_label, type) => {
      expect(backend.isConfigurable({ productId: '1359', type }, CTX)).toBe(
        false,
      );
    });
  });

  describe('create', () => {
    it('starts by Geins product id, with the channel and the buyer', async () => {
      fetchMock.mockResolvedValue(
        answer({ data: { createConfiguration: wireConfiguration() } }),
      );

      const config = await backend.create(
        { productId: '1359', quantity: 2 },
        CTX,
      );

      const { url, init, headers, body } = sentRequest();
      expect(url).toBe(URL);
      expect(init.method).toBe('POST');
      expect(headers).toMatchObject({
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-apikey': API_KEY,
        Authorization: 'Bearer user-token-1',
      });
      expect(body.query).toContain('createConfiguration(');
      expect(body.variables).toEqual({
        productId: 1359,
        quantity: 2,
        channelId: '1|se',
        languageId: 'sv-SE',
        marketId: 'SE|SEK',
      });
      expect(config.configurationId).toBe('cfg-1');
      expect(config.articleNumber).toBe('001-2');
    });

    it('sends no Authorization header for a buyer without a token', async () => {
      fetchMock.mockResolvedValue(
        answer({ data: { createConfiguration: wireConfiguration() } }),
      );
      const { userToken: _dropped, ...anonymous } = CTX;

      await backend.create({ productId: '1359', quantity: 1 }, anonymous);

      expect('Authorization' in sentRequest().headers).toBe(false);
    });

    it.each([
      ['a non-numeric id', 'abc'],
      ['an empty id', ''],
      ['a fractional id', '1.5'],
    ])('answers 404 for %s without calling out', async (_label, productId) => {
      const failure = await failureOf(() =>
        backend.create({ productId, quantity: 1 }, CTX),
      );
      expect(failure.statusCode).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('reads the document by id, with the channel and the buyer', async () => {
      fetchMock.mockResolvedValue(
        answer({ data: { getConfiguration: wireConfiguration() } }),
      );

      const config = await backend.get('cfg-1', CTX);

      const { body, headers } = sentRequest();
      expect(body.query).toContain('getConfiguration(');
      expect(body.variables).toEqual({
        configurationId: 'cfg-1',
        channelId: '1|se',
        languageId: 'sv-SE',
        marketId: 'SE|SEK',
      });
      expect(headers.Authorization).toBe('Bearer user-token-1');
      expect(config).toEqual(mapConfiguration(wireConfiguration()));
    });
  });

  describe('applyChanges', () => {
    it('sends the batch translated, with the channel and the buyer', async () => {
      const wire = wireConfiguration({ configurationId: 'cfg-7' });
      fetchMock.mockResolvedValue(
        answer({ data: { applyConfigurationChanges: wire } }),
      );

      const config = await backend.applyChanges(
        'cfg-7',
        [
          { type: 'variable', variableId: 'MW', value: 12 },
          {
            type: 'option',
            optionId: '100004',
            instanceId: '0',
            selected: true,
            quantity: 2,
            lock: 'unlock',
          },
          { type: 'quantity', quantity: 4 },
        ],
        CTX,
      );

      const { body, headers } = sentRequest();
      expect(body.query).toBe(
        loadQuery('configurator/apply-configuration-changes.graphql'),
      );
      expect(body.variables).toEqual({
        configurationId: 'cfg-7',
        changes: [
          { type: 'VARIABLE', variableId: 'MW', value: 12 },
          {
            type: 'OPTION',
            optionId: '100004',
            instanceId: '0',
            selected: true,
            quantity: 2,
            lock: 'UNLOCK',
          },
          { type: 'QUANTITY', quantity: 4 },
        ],
        channelId: '1|se',
        languageId: 'sv-SE',
        marketId: 'SE|SEK',
      });
      expect(headers.Authorization).toBe('Bearer user-token-1');
      expect(config).toEqual(mapConfiguration(wire));
    });

    it('answers 502 when the batch returns no document', async () => {
      fetchMock.mockResolvedValue(
        answer({ data: { applyConfigurationChanges: null } }),
      );
      const failure = await failureOf(() =>
        backend.applyChanges('cfg-7', [{ type: 'quantity', quantity: 1 }], CTX),
      );
      expect(failure.statusCode).toBe(502);
    });

    it("answers 422 for a batch the provider rejects, keeping the provider's reason in the log", async () => {
      const reason =
        'Variable MACHINE_TYPE is read-only: the provider sets its value';
      fetchMock.mockResolvedValue(
        answer({
          data: null,
          errors: [
            { message: reason, extensions: { code: 'ConfigurationFailed' } },
          ],
        }),
      );

      const failure = await failureOf(() =>
        backend.applyChanges(
          'cfg-7',
          [{ type: 'variable', variableId: 'MACHINE_TYPE', value: 'X' }],
          CTX,
        ),
      );

      expect(failure.statusCode).toBe(422);
      expect(logger.warn).toHaveBeenCalledWith(
        'Client error: The provider rejected the change',
        expect.anything(),
      );
      expect(
        JSON.stringify({
          message: failure.message,
          statusMessage: failure.statusMessage,
          data: failure.data,
        }),
      ).not.toContain(reason);
      const warned = JSON.stringify(
        vi.mocked(logger.warn).mock.calls as unknown[],
      );
      expect(warned).toContain(reason);
      expect(warned).toContain('ConfigurationFailed');
    });
  });

  describe('renew', () => {
    it('extends the session and answers the new expiry', async () => {
      fetchMock.mockResolvedValue(
        answer({
          data: {
            renewConfiguration: { expiresAt: '2026-09-28T12:00:00+00:00' },
          },
        }),
      );

      expect(await backend.renew('cfg-1', CTX)).toEqual({
        expiresAt: '2026-09-28T12:00:00+00:00',
      });

      const { body, headers } = sentRequest();
      expect(body.query).toBe(
        loadQuery('configurator/renew-configuration.graphql'),
      );
      expect(body.variables).toEqual({
        configurationId: 'cfg-1',
        channelId: '1|se',
        languageId: 'sv-SE',
        marketId: 'SE|SEK',
      });
      expect(headers.Authorization).toBe('Bearer user-token-1');
    });

    it('answers 502 when the renewal comes back empty', async () => {
      fetchMock.mockResolvedValue(
        answer({ data: { renewConfiguration: null } }),
      );
      expect(
        (await failureOf(() => backend.renew('cfg-1', CTX))).statusCode,
      ).toBe(502);
    });
  });

  describe('release', () => {
    it('deletes the session', async () => {
      fetchMock.mockResolvedValue(
        answer({ data: { deleteConfiguration: true } }),
      );

      await expect(backend.release('cfg-1', CTX)).resolves.toBeUndefined();

      const { body } = sentRequest();
      expect(body.query).toBe(
        loadQuery('configurator/delete-configuration.graphql'),
      );
      expect(body.variables).toEqual({
        configurationId: 'cfg-1',
        channelId: '1|se',
        languageId: 'sv-SE',
        marketId: 'SE|SEK',
      });
    });

    it.each([
      ['false', false],
      ['null', null],
    ])(
      'answers 502 when the provider says %s, never a silent success',
      async (_label, deleted) => {
        fetchMock.mockResolvedValue(
          answer({ data: { deleteConfiguration: deleted } }),
        );
        expect(
          (await failureOf(() => backend.release('cfg-1', CTX))).statusCode,
        ).toBe(502);
      },
    );
  });

  describe('commit', () => {
    it('commits and answers the frozen record', async () => {
      fetchMock.mockResolvedValue(
        answer({ data: { commitConfiguration: wireCommitted() } }),
      );

      const committed = await backend.commit('cfg-1', CTX);

      const { body, headers } = sentRequest();
      expect(body.query).toBe(
        loadQuery('configurator/commit-configuration.graphql'),
      );
      expect(body.variables).toEqual({
        configurationId: 'cfg-1',
        channelId: '1|se',
        languageId: 'sv-SE',
        marketId: 'SE|SEK',
      });
      expect(headers.Authorization).toBe('Bearer user-token-1');
      expect(committed).toEqual(
        mapCommittedConfiguration(wireCommitted(), 'cfg-1'),
      );
    });

    it('answers 502 when the commit comes back empty', async () => {
      fetchMock.mockResolvedValue(
        answer({ data: { commitConfiguration: null } }),
      );
      expect(
        (await failureOf(() => backend.commit('cfg-1', CTX))).statusCode,
      ).toBe(502);
    });

    it('answers 410 for a second commit on the same session', async () => {
      fetchMock.mockResolvedValue(graphqlError('ConfigurationGone'));
      expect(
        (await failureOf(() => backend.commit('cfg-1', CTX))).statusCode,
      ).toBe(410);
    });
  });

  describe('cartLineConfigurations', () => {
    function cartLines(items: unknown) {
      return answer({ data: { getCart: { items } } });
    }

    it('reads the lines of the cart, with the channel and the buyer', async () => {
      fetchMock.mockResolvedValue(cartLines([]));

      await backend.cartLineConfigurations('cart-1', CTX);

      const { url, body, headers } = sentRequest();
      expect(url).toBe(URL);
      expect(body.query).toBe(
        loadQuery('configurator/get-cart-line-configurations.graphql'),
      );
      expect(body.variables).toEqual({
        id: 'cart-1',
        channelId: '1|se',
        languageId: 'sv-SE',
        marketId: 'SE|SEK',
      });
      expect(headers.Authorization).toBe('Bearer user-token-1');
    });

    it('gives the read 2 s, since the cart waits for it', async () => {
      const timeout = vi.spyOn(AbortSignal, 'timeout');
      fetchMock.mockResolvedValue(cartLines([]));

      await backend.cartLineConfigurations('cart-1', CTX);

      expect(timeout.mock.calls).toEqual([[2_000]]);
      timeout.mockRestore();
    });

    it('answers the configured lines by item id, with their summary in the order sent', async () => {
      fetchMock.mockResolvedValue(
        cartLines([
          {
            id: 'item-1',
            configurationId: 'committed-1',
            configuration: {
              summary: [
                { label: 'Adapter', value: 'S45' },
                { label: 'Width (500-1500)', value: '1200 mm' },
              ],
            },
          },
          { id: 'item-2', configurationId: null, configuration: null },
        ]),
      );

      const lines = await backend.cartLineConfigurations('cart-1', CTX);

      expect([...lines]).toEqual([
        [
          'item-1',
          {
            configurationId: 'committed-1',
            summary: [
              { label: 'Adapter', value: 'S45' },
              { label: 'Width (500-1500)', value: '1200 mm' },
            ],
          },
        ],
      ]);
    });

    it('keeps a configured line whose configuration is null, with an empty summary', async () => {
      fetchMock.mockResolvedValue(
        cartLines([
          { id: 'item-1', configurationId: 'committed-1', configuration: null },
        ]),
      );

      const lines = await backend.cartLineConfigurations('cart-1', CTX);

      expect(lines.get('item-1')).toEqual({
        configurationId: 'committed-1',
        summary: [],
      });
    });

    it('reads a missing label or value as empty and skips a null row', async () => {
      fetchMock.mockResolvedValue(
        cartLines([
          {
            id: 'item-1',
            configurationId: 'committed-1',
            configuration: {
              summary: [
                null,
                { label: 'Finish', value: null },
                { label: null, value: '12 t' },
              ],
            },
          },
        ]),
      );

      const lines = await backend.cartLineConfigurations('cart-1', CTX);

      expect(lines.get('item-1')?.summary).toEqual([
        { label: 'Finish', value: '' },
        { label: '', value: '12 t' },
      ]);
    });

    it('skips a null entry and a line without an id', async () => {
      fetchMock.mockResolvedValue(
        cartLines([
          null,
          { id: null, configurationId: 'committed-1', configuration: null },
          { id: 'item-2', configurationId: 'committed-2', configuration: null },
        ]),
      );

      const lines = await backend.cartLineConfigurations('cart-1', CTX);

      expect([...lines.keys()]).toEqual(['item-2']);
    });

    it.each([
      ['no cart', () => answer({ data: { getCart: null } })],
      ['no items', () => cartLines(null)],
    ])('answers no lines for %s', async (_case, respond) => {
      fetchMock.mockResolvedValue(respond());

      const lines = await backend.cartLineConfigurations('cart-1', CTX);

      expect(lines.size).toBe(0);
    });

    it('passes a failure on', async () => {
      fetchMock.mockResolvedValue(answer({}, 503));

      expect(
        (await failureOf(() => backend.cartLineConfigurations('cart-1', CTX)))
          .statusCode,
      ).toBe(502);
    });
  });

  describe('orderLineConfigurations', () => {
    function orderRows(items: unknown) {
      return answer({ data: { getOrderPublic: { cart: { items } } } });
    }

    it('reads the rows of the order, with the channel and the buyer', async () => {
      fetchMock.mockResolvedValue(orderRows([]));

      await backend.orderLineConfigurations('order-1', CTX);

      const { url, body, headers } = sentRequest();
      expect(url).toBe(URL);
      expect(body.query).toBe(
        loadQuery('configurator/get-order-line-configurations.graphql'),
      );
      expect(body.variables).toEqual({
        publicOrderId: 'order-1',
        channelId: '1|se',
        languageId: 'sv-SE',
        marketId: 'SE|SEK',
      });
      expect(headers.Authorization).toBe('Bearer user-token-1');
    });

    it('gives the read 2 s, since the order waits for it', async () => {
      const timeout = vi.spyOn(AbortSignal, 'timeout');
      fetchMock.mockResolvedValue(orderRows([]));

      await backend.orderLineConfigurations('order-1', CTX);

      expect(timeout.mock.calls).toEqual([[2_000]]);
      timeout.mockRestore();
    });

    it('answers the configured rows by position, with the product and the summary in the order sent', async () => {
      fetchMock.mockResolvedValue(
        orderRows([
          { product: { productId: 7 }, configuration: null },
          {
            product: { productId: 1359 },
            configuration: {
              summary: [
                { label: 'Adapter', value: 'S45' },
                { label: 'Width (500-1500)', value: '1200 mm' },
              ],
            },
          },
        ]),
      );

      const lines = await backend.orderLineConfigurations('order-1', CTX);

      expect([...lines]).toEqual([
        [
          1,
          {
            productId: 1359,
            summary: [
              { label: 'Adapter', value: 'S45' },
              { label: 'Width (500-1500)', value: '1200 mm' },
            ],
          },
        ],
      ]);
    });

    it('counts a null row as a position', async () => {
      fetchMock.mockResolvedValue(
        orderRows([
          null,
          { product: { productId: 1359 }, configuration: { summary: [] } },
        ]),
      );

      const lines = await backend.orderLineConfigurations('order-1', CTX);

      expect([...lines.keys()]).toEqual([1]);
    });

    it('reads a missing product as no product id, and a null summary as empty', async () => {
      fetchMock.mockResolvedValue(
        orderRows([
          { product: null, configuration: { summary: null } },
          { configuration: { summary: [] } },
        ]),
      );

      const lines = await backend.orderLineConfigurations('order-1', CTX);

      expect([...lines]).toEqual([
        [0, { productId: null, summary: [] }],
        [1, { productId: null, summary: [] }],
      ]);
    });

    it('reads a missing label or value as empty and skips a null summary row', async () => {
      fetchMock.mockResolvedValue(
        orderRows([
          {
            product: { productId: 1359 },
            configuration: {
              summary: [
                null,
                { label: 'Finish', value: null },
                { label: null, value: '12 t' },
              ],
            },
          },
        ]),
      );

      const lines = await backend.orderLineConfigurations('order-1', CTX);

      expect(lines.get(0)?.summary).toEqual([
        { label: 'Finish', value: '' },
        { label: '', value: '12 t' },
      ]);
    });

    it.each([
      // The order is read before it exists for a while after it is placed.
      ['no order', () => answer({ data: { getOrderPublic: null } })],
      ['no cart', () => answer({ data: { getOrderPublic: { cart: null } } })],
      ['no items', () => orderRows(null)],
    ])('answers no rows for %s', async (_case, respond) => {
      fetchMock.mockResolvedValue(respond());

      const lines = await backend.orderLineConfigurations('order-1', CTX);

      expect(lines.size).toBe(0);
    });

    it('passes a failure on', async () => {
      fetchMock.mockResolvedValue(answer({}, 503));

      expect(
        (await failureOf(() => backend.orderLineConfigurations('order-1', CTX)))
          .statusCode,
      ).toBe(502);
    });
  });

  describe('addToCart', () => {
    const COMMITTED_ID = 'committed-1';
    const LINE = {
      committedConfigurationId: COMMITTED_ID,
      skuId: 1652,
      quantity: 2,
    };

    function linesWith(...configurationIds: (string | null)[]) {
      return answer({
        data: {
          getCart: {
            items: configurationIds.map((configurationId, index) => ({
              id: `line-${index}`,
              configurationId,
              configuration: null,
            })),
          },
        },
      });
    }

    function cartWith(...configurationIds: (string | null)[]) {
      return answer({
        data: {
          addToCart: {
            id: 'cart-1',
            items: configurationIds.map((configurationId, index) => ({
              id: `item-${index}`,
              configurationId,
            })),
          },
        },
      });
    }

    it('reads the cart first, then adds the line by its committed id, with the channel and the buyer', async () => {
      fetchMock
        .mockResolvedValueOnce(linesWith(null, 'another'))
        .mockResolvedValueOnce(cartWith(COMMITTED_ID));

      await backend.addToCart('cart-1', LINE, CTX);

      expect(sentRequest(0).body.query).toBe(
        loadQuery('configurator/get-cart-line-configurations.graphql'),
      );
      expect(sentRequest(0).body.variables).toEqual({
        id: 'cart-1',
        channelId: '1|se',
        languageId: 'sv-SE',
        marketId: 'SE|SEK',
      });
      const { url, body, headers } = sentRequest(1);
      expect(url).toBe(URL);
      expect(body.query).toBe(
        loadQuery('configurator/add-configured-cart-item.graphql'),
      );
      expect(body.variables).toEqual({
        id: 'cart-1',
        item: { skuId: 1652, quantity: 2, configurationId: COMMITTED_ID },
        channelId: '1|se',
        languageId: 'sv-SE',
        marketId: 'SE|SEK',
      });
      expect(headers.Authorization).toBe('Bearer user-token-1');
    });

    it('answers the line already carrying the committed id without adding it again', async () => {
      fetchMock.mockResolvedValueOnce(linesWith('another', COMMITTED_ID));

      await expect(backend.addToCart('cart-1', LINE, CTX)).resolves.toEqual({
        itemId: 'line-1',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('fails the add without adding when the cart cannot be read first', async () => {
      fetchMock.mockResolvedValueOnce(answer({}, 503));

      const failure = await failureOf(() =>
        backend.addToCart('cart-1', LINE, CTX),
      );

      expect(failure.statusCode).toBe(502);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('answers the id of the line that carries the committed id, among others', async () => {
      fetchMock
        .mockResolvedValueOnce(linesWith())
        .mockResolvedValueOnce(cartWith(null, 'another', COMMITTED_ID));

      await expect(backend.addToCart('cart-1', LINE, CTX)).resolves.toEqual({
        itemId: 'item-2',
      });
    });

    it('reads past a null entry in the items', async () => {
      fetchMock.mockResolvedValueOnce(linesWith()).mockResolvedValueOnce(
        answer({
          data: {
            addToCart: {
              id: 'cart-1',
              items: [null, { id: 'item-1', configurationId: COMMITTED_ID }],
            },
          },
        }),
      );

      await expect(backend.addToCart('cart-1', LINE, CTX)).resolves.toEqual({
        itemId: 'item-1',
      });
    });

    it.each([
      ['an empty cart', () => cartWith()],
      ['a cart without the line', () => cartWith(null, 'another')],
      ['no cart', () => answer({ data: { addToCart: null } })],
    ])(
      'answers 409 for %s, which is how a line dropped for stock arrives',
      async (_case, respond) => {
        fetchMock
          .mockResolvedValueOnce(linesWith())
          .mockResolvedValueOnce(respond());

        const failure = await failureOf(() =>
          backend.addToCart('cart-1', LINE, CTX),
        );
        expect(failure.statusCode).toBe(409);
      },
    );
  });

  describe('reopen', () => {
    it('opens a session from the cart line, with the channel and the buyer', async () => {
      fetchMock.mockResolvedValue(
        answer({
          data: { reopenCartItemConfiguration: wireConfiguration() },
        }),
      );

      const config = await backend.reopen('cart-1', 'item-1', CTX);

      const { url, body, headers } = sentRequest();
      expect(url).toBe(URL);
      expect(body.query).toBe(
        loadQuery('configurator/reopen-cart-item-configuration.graphql'),
      );
      expect(body.variables).toEqual({
        cartId: 'cart-1',
        itemId: 'item-1',
        channelId: '1|se',
        languageId: 'sv-SE',
        marketId: 'SE|SEK',
      });
      expect(headers.Authorization).toBe('Bearer user-token-1');
      expect(config).toEqual(mapConfiguration(wireConfiguration()));
    });

    it("gives the reopen 45 s, past the provider's own replay budget, and every other call 15 s", async () => {
      const timeout = vi.spyOn(AbortSignal, 'timeout');
      fetchMock.mockImplementation(async () =>
        answer({
          data: {
            reopenCartItemConfiguration: wireConfiguration(),
            getConfiguration: wireConfiguration(),
          },
        }),
      );

      await backend.reopen('cart-1', 'item-1', CTX);
      await backend.get('cfg-1', CTX);

      expect(timeout.mock.calls).toEqual([[45_000], [15_000]]);
      timeout.mockRestore();
    });

    it('codes a line removed from the cart as gone, which is how the canary answers it', async () => {
      // Measured 2026-10-05 on the monitor account: add, remove, then reopen
      // the stale item id.
      fetchMock.mockResolvedValue(
        answer({
          data: { reopenCartItemConfiguration: null },
          errors: [
            {
              message:
                'The cart has no configured item with the ID fc6abfee-10ff-4edd-8656-954b5fc2aa7d.',
              extensions: { code: 'CartItemNotConfigured' },
            },
          ],
        }),
      );

      const failure = await failureOf(() =>
        backend.reopen('cart-1', 'fc6abfee-10ff-4edd-8656-954b5fc2aa7d', CTX),
      );

      expect(failure.statusCode).toBe(404);
      expect((failure.data as { code?: string }).code).toBe('CART_LINE_GONE');
    });

    it('answers 502 when the reopen comes back without a document', async () => {
      fetchMock.mockResolvedValue(
        answer({ data: { reopenCartItemConfiguration: null } }),
      );
      expect(
        (await failureOf(() => backend.reopen('cart-1', 'item-1', CTX)))
          .statusCode,
      ).toBe(502);
    });
  });

  describe('replaceLine', () => {
    const NEW_ID = 'committed-2';

    function lines(
      ...items: { id: string; quantity: number; configurationId: string }[]
    ) {
      return answer({
        data: {
          getCart: {
            items: items.map((item) => ({ ...item, configuration: null })),
          },
        },
      });
    }

    function swapped(
      ...items: { id: string; configurationId: string | null }[]
    ) {
      return answer({ data: { updateCartItem: { id: 'cart-1', items } } });
    }

    const LINE = { id: 'item-1', quantity: 3, configurationId: 'committed-1' };

    it("reads the line, then swaps its configuration at the line's own quantity", async () => {
      fetchMock
        .mockResolvedValueOnce(lines({ ...LINE, id: 'other' }, LINE))
        .mockResolvedValueOnce(
          swapped({ id: 'item-1', configurationId: NEW_ID }),
        );

      await expect(
        backend.replaceLine('cart-1', 'item-1', NEW_ID, CTX),
      ).resolves.toEqual({ itemId: 'item-1' });

      expect(sentRequest(0).body.query).toBe(
        loadQuery('configurator/get-cart-line-configurations.graphql'),
      );
      const { url, body, headers } = sentRequest(1);
      expect(url).toBe(URL);
      expect(body.query).toBe(
        loadQuery('configurator/update-configured-cart-item.graphql'),
      );
      expect(body.variables).toEqual({
        id: 'cart-1',
        item: { id: 'item-1', quantity: 3, configurationId: NEW_ID },
        channelId: '1|se',
        languageId: 'sv-SE',
        marketId: 'SE|SEK',
      });
      expect(headers.Authorization).toBe('Bearer user-token-1');
    });

    it('answers the line without sending the swap when it already carries the new id', async () => {
      fetchMock.mockResolvedValueOnce(
        lines({ ...LINE, configurationId: NEW_ID }),
      );

      await expect(
        backend.replaceLine('cart-1', 'item-1', NEW_ID, CTX),
      ).resolves.toEqual({ itemId: 'item-1' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('answers 404, coded as a line that is gone, without swapping when the line is not in the cart', async () => {
      fetchMock.mockResolvedValueOnce(lines({ ...LINE, id: 'other' }));

      const failure = await failureOf(() =>
        backend.replaceLine('cart-1', 'item-1', NEW_ID, CTX),
      );

      expect(failure.statusCode).toBe(404);
      expect((failure.data as { code?: string }).code).toBe('CART_LINE_GONE');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('fails the swap without sending it when the cart cannot be read first', async () => {
      fetchMock.mockResolvedValueOnce(answer({}, 503));

      const failure = await failureOf(() =>
        backend.replaceLine('cart-1', 'item-1', NEW_ID, CTX),
      );

      expect(failure.statusCode).toBe(502);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it.each([
      [
        'the line still on its old id',
        () => swapped({ id: 'item-1', configurationId: 'committed-1' }),
      ],
      [
        'the new id on another line',
        () =>
          swapped(
            { id: 'item-1', configurationId: 'committed-1' },
            { id: 'item-9', configurationId: NEW_ID },
          ),
      ],
      ['an empty cart', () => swapped()],
      ['no cart', () => answer({ data: { updateCartItem: null } })],
    ])('answers 409 for %s', async (_case, respond) => {
      fetchMock
        .mockResolvedValueOnce(lines(LINE))
        .mockResolvedValueOnce(respond());

      const failure = await failureOf(() =>
        backend.replaceLine('cart-1', 'item-1', NEW_ID, CTX),
      );
      expect(failure.statusCode).toBe(409);
    });

    it.each([
      ['no cart', () => answer({ data: { getCart: null } })],
      [
        'a cart without items',
        () => answer({ data: { getCart: { items: null } } }),
      ],
    ])('answers 404 without swapping for %s', async (_case, respond) => {
      fetchMock.mockResolvedValueOnce(respond());

      const failure = await failureOf(() =>
        backend.replaceLine('cart-1', 'item-1', NEW_ID, CTX),
      );

      expect(failure.statusCode).toBe(404);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('reads past a null entry, in the cart and in the answer', async () => {
      fetchMock
        .mockResolvedValueOnce(
          answer({
            data: {
              getCart: { items: [null, { ...LINE, configuration: null }] },
            },
          }),
        )
        .mockResolvedValueOnce(
          answer({
            data: {
              updateCartItem: {
                id: 'cart-1',
                items: [null, { id: 'item-1', configurationId: NEW_ID }],
              },
            },
          }),
        );

      await expect(
        backend.replaceLine('cart-1', 'item-1', NEW_ID, CTX),
      ).resolves.toEqual({ itemId: 'item-1' });
    });

    it('fails on its own side, sending nothing, for a line with no quantity', async () => {
      fetchMock.mockResolvedValueOnce(
        lines({ ...LINE, quantity: null as unknown as number }),
      );

      const failure = await failureOf(() =>
        backend.replaceLine('cart-1', 'item-1', NEW_ID, CTX),
      );

      expect(failure.statusCode).toBe(409);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('answers 404 when the committed id is unknown upstream', async () => {
      fetchMock
        .mockResolvedValueOnce(lines(LINE))
        .mockResolvedValueOnce(graphqlError('ConfigurationNotFound'));

      const failure = await failureOf(() =>
        backend.replaceLine('cart-1', 'item-1', NEW_ID, CTX),
      );
      expect(failure.statusCode).toBe(404);
    });
  });

  describe('failures', () => {
    const calls: [string, () => Promise<unknown>][] = [
      ['create', () => backend.create({ productId: '1359', quantity: 1 }, CTX)],
      ['get', () => backend.get('cfg-1', CTX)],
      [
        'applyChanges',
        () =>
          backend.applyChanges(
            'cfg-1',
            [{ type: 'quantity', quantity: 1 }],
            CTX,
          ),
      ],
      ['renew', () => backend.renew('cfg-1', CTX)],
      ['release', () => backend.release('cfg-1', CTX)],
      ['commit', () => backend.commit('cfg-1', CTX)],
      [
        'addToCart',
        () =>
          backend.addToCart(
            'cart-1',
            { committedConfigurationId: 'c1', skuId: 1, quantity: 1 },
            CTX,
          ),
      ],
      ['reopen', () => backend.reopen('cart-1', 'item-1', CTX)],
    ];

    it.each([
      ['ConfigurationNotFound', 404],
      ['ConfigurationGone', 410],
      ['MissingCustomerNumber', 403],
      ['ConfigurationFailed', 422],
      ['ConfigurationMismatch', 422],
      ['LoginRequired', 401],
      ['CartBelongsToAnotherCompany', 403],
      ['ConfigurationNotReopenable', 422],
      ['CartItemNotConfigured', 404],
      ['SomethingElse', 502],
    ])('maps the error code %s to %i', async (code, status) => {
      for (const [name, call] of calls) {
        fetchMock.mockResolvedValueOnce(graphqlError(code));
        expect((await failureOf(call)).statusCode, name).toBe(status);
      }
    });

    it.each([
      ['CartItemNotConfigured', 'CART_LINE_GONE'],
      ['CartBelongsToAnotherCompany', 'CART_NOT_OWN'],
      ['MissingCustomerNumber', 'FORBIDDEN'],
      ['ConfigurationNotFound', 'NOT_FOUND'],
    ])(
      "answers %s with the portal's own code %s, which tells the line's refusals from the rest",
      async (upstream, code) => {
        fetchMock.mockResolvedValueOnce(graphqlError(upstream));
        const failure = await failureOf(calls[calls.length - 1]![1]);
        expect((failure.data as { code?: string } | undefined)?.code).toBe(
          code,
        );
      },
    );

    it.each([
      'ConfigurationNotFound',
      'ConfigurationGone',
      'MissingCustomerNumber',
    ])(
      'logs nothing for %s, which is an answer rather than a refusal',
      async (code) => {
        fetchMock.mockResolvedValue(graphqlError(code));
        await failureOf(calls[1]![1]);
        const lines = vi.mocked(logger.warn).mock.calls.map(([line]) => line);
        expect(lines.some((line) => line.startsWith('[configurator]'))).toBe(
          false,
        );
      },
    );

    it('finds a known code behind an unknown one', async () => {
      fetchMock.mockResolvedValue(
        answer({
          data: null,
          errors: [
            { message: 'noise', extensions: { code: 'SomethingElse' } },
            { message: 'gone', extensions: { code: 'ConfigurationGone' } },
          ],
        }),
      );
      expect((await failureOf(calls[1]![1])).statusCode).toBe(410);
    });

    it('reads a GraphQL error sent with a non-2xx status', async () => {
      fetchMock.mockResolvedValue(
        answer(
          {
            errors: [
              { message: 'x', extensions: { code: 'ConfigurationNotFound' } },
            ],
          },
          400,
        ),
      );
      expect((await failureOf(calls[1]![1])).statusCode).toBe(404);
    });

    it.each([
      ['an error without a code', () => answer({ errors: [{ message: 'x' }] })],
      ['a 500', () => answer({ message: 'boom' }, 500)],
      [
        'a body that is not JSON',
        () => new Response('<html>', { status: 200 }),
      ],
      [
        'no document and no error',
        () => answer({ data: { getConfiguration: null } }),
      ],
      ['no data at all', () => answer({})],
    ])('answers 502 for %s', async (_label, respond) => {
      fetchMock.mockResolvedValue(respond());
      expect((await failureOf(calls[1]![1])).statusCode).toBe(502);
    });

    it('answers 502 for an error beside a document', async () => {
      // A partial answer: GraphQL returns what it resolved next to the error.
      fetchMock.mockResolvedValue(
        answer({
          data: { getConfiguration: wireConfiguration() },
          errors: [{ message: 'x', extensions: { code: 'SomethingElse' } }],
        }),
      );
      expect((await failureOf(calls[1]![1])).statusCode).toBe(502);
    });

    it('answers 502 for a non-2xx status even with a document', async () => {
      fetchMock.mockResolvedValue(
        answer({ data: { getConfiguration: wireConfiguration() } }, 500),
      );
      expect((await failureOf(calls[1]![1])).statusCode).toBe(502);
    });

    it('answers 502 when the request itself fails', async () => {
      fetchMock.mockRejectedValue(
        new TypeError(`fetch failed: connect ECONNREFUSED ${URL}`),
      );
      expect((await failureOf(calls[1]![1])).statusCode).toBe(502);
    });

    it('never puts the URL or the key into an error or a log line', async () => {
      const responses = [
        () =>
          Promise.reject(
            new TypeError(`fetch failed ${URL} x-apikey=${API_KEY}`),
          ),
        () => Promise.resolve(answer({ message: `${URL} ${API_KEY}` }, 500)),
        () =>
          Promise.resolve(
            answer({
              errors: [
                {
                  message: `${URL} rejected ${API_KEY}`,
                  extensions: { code: 'SomethingElse' },
                },
              ],
            }),
          ),
        () => Promise.resolve(graphqlError('ConfigurationGone')),
      ];

      for (const respond of responses) {
        fetchMock.mockImplementationOnce(respond);
        const failure = await failureOf(calls[1]![1]);
        const surface = JSON.stringify({
          message: failure.message,
          statusMessage: failure.statusMessage,
          data: failure.data,
          cause: String(failure.cause ?? ''),
        });
        expect(surface).not.toContain(URL);
        expect(surface).not.toContain(API_KEY);
      }

      const logged = JSON.stringify(logSpies.map((spy) => spy.mock.calls));
      expect(logged).not.toContain(URL);
      expect(logged).not.toContain(API_KEY);
    });

    it('answers 500 without calling out when the context has no target', async () => {
      const { merchantApi: _dropped, ...narrow } = CTX;
      const failure = await failureOf(() => backend.get('cfg-1', narrow));
      expect(failure.statusCode).toBe(500);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('gives up on a request that does not answer', async () => {
      fetchMock.mockResolvedValue(
        answer({ data: { getConfiguration: wireConfiguration() } }),
      );
      await backend.get('cfg-1', CTX);
      expect(sentRequest().init.signal).toBeInstanceOf(AbortSignal);
    });
  });
});

// ---------------------------------------------------------------------------
// The queries
//
// GraphQL fragments cannot recurse, so the tree is unrolled to a fixed depth.
// Nodes below it are not selected and cannot be told apart from absent ones.
// ---------------------------------------------------------------------------

const SECTION_DEPTH = 4;
const GROUP_DEPTH = 3;

describe('the configuration queries', () => {
  const count = (text: string, needle: string) => text.split(needle).length - 1;

  it.each([
    ['configurator/create-configuration.graphql', 'createConfiguration('],
    ['configurator/get-configuration.graphql', 'getConfiguration('],
    [
      'configurator/apply-configuration-changes.graphql',
      'applyConfigurationChanges(',
    ],
  ])('%s selects the document to the agreed depth', (path, operation) => {
    const query = loadQuery(path);

    expect(query).toContain(operation);
    expect(count(query, '...CpqSectionFields')).toBe(SECTION_DEPTH);
    expect(count(query, '...CpqGroupFields')).toBe(GROUP_DEPTH);
    expect(count(query, '...CpqGroupTree')).toBe(SECTION_DEPTH);
    // The embedded product in the portal's ordinary list shape.
    expect(query).toContain('fragment ListProduct on ProductType');
    expect(query).toContain('fragment Price on PriceType');
    for (const fragment of [
      'CpqConfiguration on CpqConfigurationType',
      'CpqSectionFields on CpqSectionType',
      'CpqGroupTree on CpqOptionGroupType',
      'CpqGroupFields on CpqOptionGroupType',
      'CpqVariable on CpqVariableType',
      'CpqOption on CpqOptionType',
      'CpqMessage on CpqMessageType',
    ]) {
      expect(query, fragment).toContain(`fragment ${fragment}`);
    }
  });

  it.each([
    ['configurator/renew-configuration.graphql', 'renewConfiguration('],
    ['configurator/delete-configuration.graphql', 'deleteConfiguration('],
    ['configurator/commit-configuration.graphql', 'commitConfiguration('],
  ])('%s sends the session and the channel', (path, operation) => {
    const query = loadQuery(path);
    expect(query).toContain(operation);
    for (const variable of [
      '$configurationId: String!',
      '$channelId: String',
      '$languageId: String',
      '$marketId: String',
    ]) {
      expect(query, variable).toContain(variable);
    }
  });

  it('selects every field of the committed record', () => {
    const query = loadQuery('configurator/commit-configuration.graphql');
    for (const field of [
      'committedConfigurationId',
      'configurationId',
      'articleNumber',
      'quantity',
      'unitPrice',
      'summary',
      'label',
      'value',
    ]) {
      expect(query, field).toContain(field);
    }
    expect(query).toContain('fragment Price on PriceType');
  });

  it('declares the change list as the schema does', () => {
    // A variable typed looser than the argument fails GraphQL validation
    // (VARIABLES_IN_ALLOWED_POSITION) before the provider sees the batch.
    const query = loadQuery('configurator/apply-configuration-changes.graphql');
    expect(query).toContain('$changes: [CpqConfigurationChangeInputType!]!');
  });

  it('reads an order row by its product and its configuration summary only', () => {
    const query = loadQuery(
      'configurator/get-order-line-configurations.graphql',
    );
    expect(query).toContain('getOrderPublic(');
    expect(query).toContain('$publicOrderId: Guid!');
    expect(query).toContain('productId');
    expect(query).toContain('summary');
    // Both ids are null on an order row by design.
    expect(query).not.toContain('configurationId');
  });

  it('creates by product id, not by article number', () => {
    const query = loadQuery('configurator/create-configuration.graphql');
    expect(query).toContain('productId: $productId');
    expect(query).not.toContain('$articleNumber');
  });
});

describe('the cart line swap', () => {
  it("sends the cart, the line's input and the channel, and reads back every line's id and configuration", () => {
    const query = loadQuery('configurator/update-configured-cart-item.graphql');
    expect(query).toContain('updateCartItem(');
    for (const needle of [
      '$id: String!',
      '$item: CartItemInputType!',
      '$channelId: String',
      '$languageId: String',
      '$marketId: String',
      'configurationId',
    ]) {
      expect(query, needle).toContain(needle);
    }
  });

  it("reads each line's quantity, which the swap sends back", () => {
    expect(
      loadQuery('configurator/get-cart-line-configurations.graphql'),
    ).toMatch(/items\s*\{[^}]*\bquantity\b/);
  });
});

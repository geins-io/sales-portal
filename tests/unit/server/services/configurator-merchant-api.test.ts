import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAppError, ErrorCode } from '../../../../server/utils/errors';
import { logger } from '../../../../server/utils/logger';
import type { ConfiguratorContext } from '../../../../server/services/configurator';
import { createMerchantApiConfiguratorBackend } from '../../../../server/services/configurator-merchant-api';
import { mapConfiguration } from '../../../../server/services/configurator-merchant-api/map';
import type {
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

    it('drops INFO and UNKNOWN, which the document type cannot carry', () => {
      const config = mapConfiguration(
        wireConfiguration({
          messages: [
            { severity: 'INFO', text: 'i' },
            { severity: 'UNKNOWN', text: 'u' },
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

  describe('failures', () => {
    const calls: [string, () => Promise<unknown>][] = [
      ['create', () => backend.create({ productId: '1359', quantity: 1 }, CTX)],
      ['get', () => backend.get('cfg-1', CTX)],
    ];

    it.each([
      ['ConfigurationNotFound', 404],
      ['ConfigurationGone', 410],
      ['MissingCustomerNumber', 403],
      ['SomethingElse', 502],
    ])('maps the error code %s to %i', async (code, status) => {
      for (const [name, call] of calls) {
        fetchMock.mockResolvedValueOnce(graphqlError(code));
        expect((await failureOf(call)).statusCode, name).toBe(status);
      }
    });

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

  describe('the verbs that land later', () => {
    it.each([
      ['applyChanges', () => backend.applyChanges('c1', [], CTX)],
      ['renew', () => backend.renew('c1', CTX)],
      ['release', () => backend.release('c1', CTX)],
      ['commit', () => backend.commit('c1', CTX)],
    ])('%s answers 501 without calling out', async (_name, call) => {
      expect((await failureOf(call)).statusCode).toBe(501);
      expect(fetchMock).not.toHaveBeenCalled();
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

  it('creates by product id, not by article number', () => {
    const query = loadQuery('configurator/create-configuration.graphql');
    expect(query).toContain('productId: $productId');
    expect(query).not.toContain('$articleNumber');
  });
});

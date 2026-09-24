import { describe, it, expect } from 'vitest';
import type {
  Configuration,
  ConfigurationChange,
  ConfigurationOption,
  CommittedConfiguration,
  CreateConfigurationInput,
} from '#shared/types/configurator';
import { makeListProduct } from '../../fixtures/product';

// ---------------------------------------------------------------------------
// The sample document below is the real assertion: it is typed as
// `Configuration`, and `pnpm typecheck` compiles this file through the root
// tsconfig reference, so the types cannot drift from the CPQ contract without
// the gate failing. The runtime expectations only pin the few relationships a
// reader would otherwise have to infer from the shape.
// ---------------------------------------------------------------------------

const option: ConfigurationOption = {
  id: '102',
  instanceId: '0',
  productId: '900123456789',
  selected: true,
  available: true,
  selectionSource: 'manual',
  selectionSourceRaw: '10',
  quantity: 2,
  defaultQuantity: 1,
  minQuantity: 1,
  maxQuantity: 10,
  unitPrice: { sellingPriceExVat: 1250, currency: { code: 'SEK' } },
  discountPercent: 0,
  messages: [],
  product: makeListProduct({ productId: 42 }),
};

const configuration: Configuration = {
  configurationId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  expiresAt: '2026-09-15T13:45:00Z',
  isValid: false,
  productId: '900000000001',
  quantity: 5,
  unitPrice: { sellingPriceExVat: 18400, currency: { code: 'SEK' } },
  discountPercent: 12.5,
  weightPerUnit: 4.2,
  templateId: 'TPL-77',
  templateVersion: '3',
  messages: [{ severity: 'error', text: 'Pick a frame colour.' }],
  sections: [
    {
      id: '1',
      name: 'Frame',
      visible: true,
      variables: [
        {
          id: '1024',
          name: 'Width',
          description: 'Outer frame width.',
          valueType: 'number',
          value: 1250,
          defaultValue: 1000,
          required: true,
          available: true,
          min: 400,
          max: 2400,
          step: 10,
          decimals: 0,
          unit: 'mm',
          selectionSource: 'none',
          valueSource: 'manual',
          messages: [],
        },
      ],
      optionGroups: [
        {
          id: '55',
          code: 'COLOUR',
          name: 'Colour',
          available: true,
          minSelections: 1,
          maxSelections: 1,
          quantityEditable: false,
          optionGroups: [],
          options: [option],
          messages: [],
        },
      ],
      sections: [
        {
          id: '1.1',
          name: 'Surface',
          visible: false,
          sections: [],
          variables: [],
          optionGroups: [],
          messages: [{ severity: 'warning', text: 'Hidden by a rule.' }],
        },
      ],
      messages: [],
    },
  ],
};

const changes: ConfigurationChange[] = [
  { type: 'variable', variableId: '1024', value: 1250 },
  {
    type: 'option',
    optionId: '102',
    instanceId: '0',
    selected: true,
    quantity: 1,
    lock: 'none',
  },
  { type: 'quantity', quantity: 5 },
];

describe('CPQ configuration document types', () => {
  it('nests sections, option groups and the embedded product', () => {
    const section = configuration.sections[0]!;
    expect(section.sections[0]!.visible).toBe(false);
    expect(section.optionGroups[0]!.options[0]!.product.productId).toBe(42);
  });

  it('keeps the provider part id separate from the Geins product id', () => {
    // `productId` is the provider's part id (string, Int64 on the wire);
    // `product.productId` is the Geins product id (number).
    expect(option.productId).toBe('900123456789');
    expect(option.product.productId).toBe(42);
  });

  it('narrows a change on its type discriminant', () => {
    const variableChange = changes.find(
      (c): c is Extract<ConfigurationChange, { type: 'variable' }> =>
        c.type === 'variable',
    );
    expect(variableChange?.value).toBe(1250);
  });

  it('accepts a create input without customer, company or currency', () => {
    const input: CreateConfigurationInput = {
      productId: '900000000001',
      quantity: 5,
    };
    expect(Object.keys(input)).toEqual(['productId', 'quantity']);
  });

  it('freezes a committed snapshot with a human-readable summary', () => {
    const committed: CommittedConfiguration = {
      committedConfigurationId: 'cc-1',
      configurationId: configuration.configurationId,
      productId: configuration.productId,
      quantity: configuration.quantity,
      unitPrice: configuration.unitPrice,
      summary: [
        { label: 'Width', value: '1250 mm' },
        {
          label: 'Colour',
          value: 'Anthracite',
          price: { sellingPriceExVat: 1250, currency: { code: 'SEK' } },
        },
      ],
    };
    expect(committed.summary[1]!.price?.currency?.code).toBe('SEK');
  });
});

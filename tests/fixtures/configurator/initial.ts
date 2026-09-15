import type {
  Configuration,
  ConfigurationOption,
  ConfigurationOptionGroup,
  ConfigurationVariable,
} from '#shared/types/configurator';
import { makeListProduct } from '../product';
import { CURRENCY, makeConfigurationOption } from './builders';

// ---------------------------------------------------------------------------
// "Arbetsbord Pro" as the CPQ service returns it on create.
//
// The product is the CPQ service's own seeded mock: article KONF-1001, base
// price 3200 SEK, four variables and five option groups including the
// 26-option RAL colour group, restructured into two nested sections (Frame
// holds the variables, Finish nests inside it). The steel-top rule therefore
// narrows a variable in the parent section from a group in the child one,
// which is the cascade shape the UI has to survive.
//
// The colour group arrives empty: a made-to-order finish has no default in the
// seed, and that unmet `minSelections: 1` is what makes the fresh document
// invalid. It stays empty in all three documents.
//
// Prices are the mock's arithmetic (base + option delta + variable
// delta-from-default). The real provider computes a multiplicative formula
// server-side, so nothing about these numbers describes the contract and no
// test pinning them may be named like a contract test.
//
// Ids are the seed's slugs, readable on purpose. A real provider's ids are
// opaque numeric strings — nothing may parse them.
// ---------------------------------------------------------------------------

export const BASE_PRICE = 3200;

/**
 * Far in the future so nothing that checks liveness has to fake a clock. A
 * test for the expired-session path overrides it.
 */
export const EXPIRES_AT = '2030-01-01T00:00:00.000Z';

function option(
  id: string,
  name: string,
  net: number,
  productId: number,
  overrides: Partial<ConfigurationOption> = {},
): ConfigurationOption {
  return makeConfigurationOption({
    id,
    unitPrice: { net, currency: CURRENCY },
    product: makeListProduct({
      productId,
      name,
      alias: id,
      canonicalUrl: `/products/${id}`,
      articleNumber: `KONF-1001-${id.toUpperCase()}`,
      primaryCategory: { name: 'Workbenches' },
      unitPrice: {
        sellingPriceIncVat: Math.round(net * 1.25),
        sellingPriceIncVatFormatted: `${Math.round(net * 1.25)} kr`,
        isDiscounted: false,
      },
      productImages: [
        { fileName: `${id}.jpg`, url: `/i/${id}.jpg`, isPrimary: true },
      ],
    }),
    ...overrides,
  });
}

function variable(
  overrides: Partial<ConfigurationVariable> & { id: string; name: string },
): ConfigurationVariable {
  return {
    description: '',
    valueType: 'number',
    value: 0,
    defaultValue: 0,
    required: true,
    available: true,
    decimals: 0,
    selectionSource: 'none',
    valueSource: 'initial',
    messages: [],
    ...overrides,
  };
}

function group(
  overrides: Partial<ConfigurationOptionGroup> & {
    id: string;
    code: string;
    name: string;
  },
): ConfigurationOptionGroup {
  return {
    available: true,
    quantityEditable: false,
    optionGroups: [],
    options: [],
    messages: [],
    ...overrides,
  };
}

/** `[id, name, net]`, the seed's RAL list in seed order. */
const RAL_COLOURS: [string, string, number][] = [
  ['ral-9005', 'Black (RAL 9005)', 0],
  ['ral-9010', 'White (RAL 9010)', 0],
  ['ral-7035', 'Light grey (RAL 7035)', 0],
  ['ral-7016', 'Anthracite grey (RAL 7016)', 150],
  ['ral-9006', 'Silver grey (RAL 9006)', 200],
  ['ral-5010', 'Blue (RAL 5010)', 150],
  ['ral-5012', 'Light blue (RAL 5012)', 150],
  ['ral-3020', 'Red (RAL 3020)', 150],
  ['ral-3005', 'Wine red (RAL 3005)', 150],
  ['ral-6011', 'Green (RAL 6011)', 150],
  ['ral-6005', 'Moss green (RAL 6005)', 150],
  ['ral-1023', 'Yellow (RAL 1023)', 150],
  ['ral-2004', 'Orange (RAL 2004)', 200],
  ['ral-1015', 'Beige (RAL 1015)', 150],
  ['ral-8017', 'Brown (RAL 8017)', 150],
  ['ral-3015', 'Pink (RAL 3015)', 200],
  ['ral-9001', 'Cream white (RAL 9001)', 0],
  ['ral-7024', 'Graphite grey (RAL 7024)', 150],
  ['ral-5003', 'Dark blue (RAL 5003)', 150],
  ['ral-5018', 'Turquoise (RAL 5018)', 200],
  ['ral-6019', 'Pale green (RAL 6019)', 150],
  ['ral-6003', 'Olive green (RAL 6003)', 150],
  ['ral-1004', 'Golden yellow (RAL 1004)', 200],
  ['ral-8011', 'Chocolate brown (RAL 8011)', 150],
  ['ral-8004', 'Terracotta (RAL 8004)', 200],
  ['ral-4008', 'Purple (RAL 4008)', 200],
];

function makeFinishSection() {
  return {
    id: 'finish',
    name: 'Finish',
    visible: true,
    sections: [],
    variables: [],
    messages: [],
    optionGroups: [
      group({
        id: 'top',
        code: 'TOP',
        name: 'Table top',
        minSelections: 1,
        maxSelections: 1,
        options: [
          option('top-laminate', 'Laminate top', 0, 902_001, {
            selected: true,
            selectionSource: 'initial',
          }),
          option('top-wood', 'Solid beech top', 1400, 902_002),
          option('top-steel', 'Stainless steel top', 2600, 902_003),
        ],
      }),
      group({
        id: 'color',
        code: 'COLOUR',
        name: 'Colour',
        minSelections: 1,
        maxSelections: 1,
        options: RAL_COLOURS.map(([id, name, net], index) =>
          option(id, name, net, 903_001 + index),
        ),
        messages: [{ severity: 'error', text: 'Select a colour.' }],
      }),
      group({
        id: 'accessories',
        code: 'ACCESSORIES',
        name: 'Accessories',
        quantityEditable: true,
        options: [
          option('acc-pegboard', 'Tool pegboard', 900, 904_001, {
            maxQuantity: 2,
          }),
          option('acc-light', 'LED light bar', 700, 904_002, {
            maxQuantity: 2,
          }),
          option('acc-power', 'Power strip', 550, 904_003, { maxQuantity: 4 }),
          option('acc-castors', 'Braked castors', 650, 904_004),
        ],
      }),
    ],
  };
}

export function makeInitialConfiguration(
  overrides: Partial<Configuration> = {},
): Configuration {
  return {
    configurationId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    expiresAt: EXPIRES_AT,
    // A required option group is empty, so a fresh document is never valid.
    isValid: false,
    productId: '900000000000123',
    quantity: 1,
    unitPrice: { net: BASE_PRICE, currency: CURRENCY },
    discountPercent: 0,
    weightPerUnit: 38.5,
    templateId: 'TPL-KONF-1001',
    templateVersion: '4',
    messages: [],
    sections: [
      {
        id: 'frame',
        name: 'Frame',
        visible: true,
        messages: [],
        variables: [
          variable({
            id: 'width',
            name: 'Width',
            description: 'Outer width of the bench.',
            value: 1200,
            defaultValue: 1200,
            min: 800,
            max: 2000,
            step: 100,
            unit: 'mm',
          }),
          variable({
            id: 'depth',
            name: 'Depth',
            description: 'Outer depth of the bench.',
            value: 700,
            defaultValue: 700,
            min: 600,
            max: 900,
            step: 50,
            unit: 'mm',
          }),
          variable({
            id: 'shelves',
            name: 'Shelves',
            description: 'Number of shelves under the top.',
            required: false,
            min: 0,
            max: 4,
            step: 1,
            unit: 'pcs',
          }),
          variable({
            id: 'oversize',
            name: 'Oversize margin',
            description: 'Manufacturing margin added to the ordered size.',
            required: false,
            min: 0,
            max: 10,
            step: 1,
            unit: '%',
          }),
        ],
        optionGroups: [
          group({
            id: 'legs',
            code: 'LEGS',
            name: 'Leg frame',
            minSelections: 1,
            maxSelections: 1,
            options: [
              option('legs-fixed', 'Fixed height legs', 0, 901_001, {
                selected: true,
                selectionSource: 'initial',
              }),
              option('legs-manual', 'Hand-crank height legs', 1800, 901_002),
              option('legs-electric', 'Electric height legs', 4200, 901_003),
            ],
          }),
          group({
            id: 'industrial',
            code: 'INDUSTRIAL',
            name: 'Industrial options',
            options: [
              option('ind-esd', 'ESD earthing kit', 1200, 905_001),
              option('ind-heavy', 'Reinforced frame, 600 kg', 2100, 905_002),
            ],
          }),
        ],
        sections: [makeFinishSection()],
      },
    ],
    ...overrides,
  };
}

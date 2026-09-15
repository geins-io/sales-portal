import type {
  Configuration,
  ConfigurationOption,
  ConfigurationSection,
} from '#shared/types/configurator';
import { findOption, findVariable } from '../document';
import { seedGroup, seedOption, seedVariable } from './builders';
import type { Seed } from './types';

// ---------------------------------------------------------------------------
// "Arbetsbord Pro", article KONF-1001 — the product the CPQ service seeds its
// own mock with: base price 3200, four variables and five option groups
// including the 26-option RAL colour group, restructured into two nested
// sections. The steel-top rule therefore narrows a variable in the parent
// section from a group in the child one, which is the cascade shape the UI has
// to survive.
//
// The colour group arrives empty: a made-to-order finish has no default in the
// seed, and that unmet `minSelections: 1` is what makes a fresh document
// invalid.
//
// Ids are the seed's slugs, readable on purpose. A real provider's ids are
// opaque numeric strings — nothing may parse them.
// ---------------------------------------------------------------------------

export const ARBETSBORD_PRO_ID = '900000000000123';

const ARTICLE = 'KONF-1001';
const BASE_PRICE = 3200;
const CATEGORY = 'Workbenches';

/** The width the steel top cannot exceed. */
const STEEL_MAX_WIDTH = 1600;

function option(
  id: string,
  name: string,
  net: number,
  productId: number,
  overrides: Partial<ConfigurationOption> = {},
): ConfigurationOption {
  return seedOption(
    { id, name, net, productId, article: ARTICLE, category: CATEGORY },
    overrides,
  );
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

function finishSection(): ConfigurationSection {
  return {
    id: 'finish',
    name: 'Finish',
    visible: true,
    sections: [],
    variables: [],
    messages: [],
    optionGroups: [
      seedGroup({
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
      seedGroup({
        id: 'color',
        code: 'COLOUR',
        name: 'Colour',
        minSelections: 1,
        maxSelections: 1,
        options: RAL_COLOURS.map(([id, name, net], index) =>
          option(id, name, net, 903_001 + index),
        ),
      }),
      seedGroup({
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

function buildSections(): ConfigurationSection[] {
  return [
    {
      id: 'frame',
      name: 'Frame',
      visible: true,
      messages: [],
      variables: [
        seedVariable({
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
        seedVariable({
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
        seedVariable({
          id: 'shelves',
          name: 'Shelves',
          description: 'Number of shelves under the top.',
          required: false,
          min: 0,
          max: 4,
          step: 1,
          unit: 'pcs',
        }),
        seedVariable({
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
        seedGroup({
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
        seedGroup({
          id: 'industrial',
          code: 'INDUSTRIAL',
          name: 'Industrial options',
          options: [
            option('ind-esd', 'ESD earthing kit', 1200, 905_001),
            option('ind-heavy', 'Reinforced frame, 600 kg', 2100, 905_002),
          ],
        }),
      ],
      sections: [finishSection()],
    },
  ];
}

function electricLegsSelected(config: Configuration): boolean {
  return findOption(config, 'legs-electric')?.selected === true;
}

/** Electric legs need mains power, so the provider selects the strip itself. */
function powerStripFollowsElectricLegs(config: Configuration): void {
  if (!electricLegsSelected(config)) return;
  const power = findOption(config, 'acc-power');
  if (!power) return;
  power.selected = true;
  power.selectionSource = 'groupRule';
  power.messages = [
    { severity: 'warning', text: 'Electric legs require a power strip.' },
  ];
}

function castorsClashWithElectricLegs(config: Configuration): void {
  if (!electricLegsSelected(config)) return;
  const castors = findOption(config, 'acc-castors');
  if (!castors) return;
  castors.available = false;
  castors.selected = false;
  castors.messages = [
    {
      severity: 'warning',
      text: 'Braked castors cannot be combined with electric legs.',
    },
  ];
}

/**
 * A steel top is heavier than the frame carries at full width, so the provider
 * narrows the bound and returns a value inside it. A value the buyer already
 * chose is clamped rather than refused: the change that narrowed the bound was
 * a different change, and the provider never answers one with an error about
 * another.
 */
function steelTopNarrowsTheWidth(config: Configuration): void {
  if (findOption(config, 'top-steel')?.selected !== true) return;
  const width = findVariable(config, 'width');
  if (!width) return;
  width.max = STEEL_MAX_WIDTH;
  if (typeof width.value === 'number' && width.value > STEEL_MAX_WIDTH) {
    width.value = STEEL_MAX_WIDTH;
    width.valueSource = 'fallback';
    width.messages = [
      {
        severity: 'warning',
        text: `A stainless steel top is limited to ${STEEL_MAX_WIDTH} mm.`,
      },
    ];
  }
}

export const arbetsbordPro: Seed = {
  productId: ARBETSBORD_PRO_ID,
  templateId: `TPL-${ARTICLE}`,
  templateVersion: '4',
  basePrice: BASE_PRICE,
  weightPerUnit: 38.5,
  variableRates: { width: 1.5, depth: 1, shelves: 450, oversize: 120 },
  formulas: {},
  cascades: [
    powerStripFollowsElectricLegs,
    castorsClashWithElectricLegs,
    steelTopNarrowsTheWidth,
  ],
  buildSections,
};

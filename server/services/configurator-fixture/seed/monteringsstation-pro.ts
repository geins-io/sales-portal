import type {
  Configuration,
  ConfigurationOption,
  ConfigurationSection,
} from '#shared/types/configurator';
import { findOption, findVariable } from '../document';
import { seedGroup, seedOption, seedVariable } from './builders';
import type { Seed } from './types';

// ---------------------------------------------------------------------------
// "Monteringsstation Pro", article KONF-1003 — the seed that has depth.
//
// The other two are shallow by nature: the workbench mirrors the platform's
// mock, and the cabinet exists for three single states. Neither can show what a
// nested tree reads like, and nesting is the contract's own model — sections
// hold sections, recursively. This product carries the two shapes no seeded
// document had:
//
//   * three levels. `Structure` holds `Worktop`, which holds `Edge trim`.
//   * a hidden section with a visible child. `Logistics` arrives invisible and
//     `Packaging` inside it does not: the document says show one and not the
//     other, and the rule that a hidden parent takes its whole subtree with it
//     had no data behind it until now.
//   * a section that is a way in rather than a page. `Accessories` has two
//     visible children and nothing of its own, and `Tool holding` inside it has
//     one child and nothing of its own. Neither shape existed in a document.
//   * option groups inside option groups, in `Storage`: `Drawer unit` holds
//     one nested list and `Small parts storage` holds three. The contract
//     nests them and no seed did, so the shape was only ever unit-tested.
//
// Every section carries real choices, so no page of it is empty, and every
// required group arrives with a selection — the document is valid at `create`
// and stays that way unless the buyer empties something.
//
// Ids are the seed's slugs, readable on purpose. A real provider's ids are
// opaque numeric strings — nothing may parse them.
// ---------------------------------------------------------------------------

export const MONTERINGSSTATION_PRO_ID = '900000000000125';

/** The catalogue product on the team tenant, alias `monteringsstation-pro`. */
export const MONTERINGSSTATION_PRO_GEINS_ID = '1103';

const ARTICLE = 'KONF-1003';
const BASE_PRICE = 7400;
const CATEGORY = 'Assembly stations';

/** The length above which a station needs the third leg pair. */
const THIRD_LEG_LENGTH = 3000;

const LITRES_PER_CUBIC_MM = 1_000_000;

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

function numberOf(config: Configuration, id: string): number {
  const value = findVariable(config, id)?.value;
  return typeof value === 'number' ? value : 0;
}

/** Level three: the trim around the worktop, inside the worktop's own section. */
function edgeSection(): ConfigurationSection {
  return {
    id: 'edge',
    name: 'Edge trim',
    sortIndex: 11,
    visible: true,
    sections: [],
    messages: [],
    variables: [
      seedVariable({
        id: 'edge-radius',
        name: 'Corner radius',
        sortIndex: 13,
        description: 'Radius the trim is mitred to at the corners.',
        required: false,
        value: 5,
        defaultValue: 5,
        min: 0,
        max: 30,
        step: 5,
        unit: 'mm',
      }),
    ],
    optionGroups: [
      seedGroup({
        id: 'edge-profile',
        code: 'EDGE',
        name: 'Edge profile',
        sortIndex: 12,
        minSelections: 1,
        maxSelections: 1,
        options: [
          option('edge-abs', 'ABS edge band', 0, 907_001, {
            selected: true,
            selectionSource: 'initial',
          }),
          option('edge-beech', 'Solid beech lipping', 620, 907_002),
          option('edge-alu', 'Anodised aluminium profile', 940, 907_003),
        ],
      }),
    ],
  };
}

/** Level two: the surface, between the frame that carries it and its trim. */
function worktopSection(): ConfigurationSection {
  return {
    id: 'worktop',
    name: 'Worktop',
    sortIndex: 7,
    visible: true,
    messages: [],
    variables: [
      seedVariable({
        id: 'overhang',
        name: 'Front overhang',
        sortIndex: 10,
        description: 'How far the top reaches past the frame.',
        required: false,
        value: 20,
        defaultValue: 20,
        min: 0,
        max: 80,
        step: 10,
        unit: 'mm',
      }),
    ],
    optionGroups: [
      seedGroup({
        id: 'top',
        code: 'TOP',
        name: 'Worktop material',
        sortIndex: 8,
        minSelections: 1,
        maxSelections: 1,
        options: [
          option('top-laminate', 'Laminate, 30 mm', 0, 907_010, {
            selected: true,
            selectionSource: 'initial',
          }),
          option('top-beech', 'Solid beech, 40 mm', 2100, 907_011),
          option('top-steel', 'Stainless steel, 1.5 mm on ply', 3400, 907_012),
        ],
      }),
      seedGroup({
        id: 'top-treatment',
        code: 'TREATMENT',
        name: 'Surface treatment',
        sortIndex: 9,
        options: [
          option('treat-esd', 'ESD-dissipative coating', 1250, 907_013),
          option('treat-oil', 'Oiled finish', 480, 907_014),
        ],
      }),
    ],
    sections: [edgeSection()],
  };
}

/** The branch the buyer never sees, and the one section inside it that says it is visible. */
function logisticsSection(): ConfigurationSection {
  return {
    // Warehouse data the provider keeps on the document. It arrives invisible
    // and takes `Packaging` with it: a child does not escape a parent the
    // buyer was never shown, whatever the child says about itself.
    id: 'logistics',
    name: 'Logistics',
    sortIndex: 26,
    visible: false,
    messages: [],
    optionGroups: [],
    variables: [
      seedVariable({
        id: 'ship-class',
        name: 'Shipping class',
        sortIndex: 27,
        description: 'Freight class the assembled station ships under.',
        valueType: 'string',
        value: 'FRK-3',
        defaultValue: 'FRK-3',
        required: false,
      }),
    ],
    sections: [
      {
        // `visible: true` inside an invisible parent — the whole point of this
        // branch. Nothing here may reach the buyer.
        id: 'packaging',
        name: 'Packaging',
        sortIndex: 28,
        visible: true,
        sections: [],
        messages: [],
        variables: [
          seedVariable({
            id: 'crate-volume',
            name: 'Crate volume',
            sortIndex: 30,
            description: 'Packed volume, computed from the ordered size.',
            required: false,
            decimals: 1,
            unit: 'l',
            valueSource: 'formula',
            selectionSource: 'locked',
          }),
        ],
        optionGroups: [
          seedGroup({
            id: 'crate',
            code: 'CRATE',
            name: 'Crate type',
            sortIndex: 29,
            minSelections: 1,
            maxSelections: 1,
            options: [
              option('crate-ply', 'Plywood crate', 0, 907_020, {
                selected: true,
                selectionSource: 'locked',
              }),
              option('crate-steel', 'Returnable steel rack', 0, 907_021),
            ],
          }),
        ],
      },
    ],
  };
}

/**
 * A section that is a way in rather than a page: no groups and no variables of
 * its own, two visible children. The document had no such shape, and both the
 * subsection menu and the fallback under it are rules no seed could show.
 *
 * `Tool holding` is the fallback's data — one child and nothing of its own to
 * answer — and `Waste handling` is the ordinary page beside it.
 *
 * It sits last in the array, numbered from 31: the seed runs one counter
 * through the whole document and nothing is free between `Power and lighting`'s
 * last member and `Logistics`. Order comes from `sortIndex`, and `Logistics` is
 * invisible, so the buyer still reads this as the fourth section.
 */
function accessoriesSection(): ConfigurationSection {
  return {
    id: 'accessories',
    name: 'Accessories',
    sortIndex: 31,
    visible: true,
    messages: [],
    variables: [],
    optionGroups: [],
    sections: [
      {
        id: 'tool-holding',
        name: 'Tool holding',
        sortIndex: 32,
        visible: true,
        messages: [],
        variables: [],
        optionGroups: [],
        sections: [
          {
            id: 'tool-rails',
            name: 'Tool rails',
            sortIndex: 33,
            visible: true,
            sections: [],
            messages: [],
            variables: [],
            optionGroups: [
              seedGroup({
                id: 'rail-length',
                code: 'RAIL',
                name: 'Rail length',
                sortIndex: 34,
                minSelections: 1,
                maxSelections: 1,
                options: [
                  option('rail-half', 'Half the worktop length', 0, 907_070, {
                    selected: true,
                    selectionSource: 'initial',
                  }),
                  option('rail-full', 'Full worktop length', 460, 907_071),
                ],
              }),
            ],
          },
        ],
      },
      {
        id: 'waste',
        name: 'Waste handling',
        sortIndex: 35,
        visible: true,
        sections: [],
        messages: [],
        variables: [],
        optionGroups: [
          seedGroup({
            id: 'waste-bin',
            code: 'WASTE',
            name: 'Waste bin',
            sortIndex: 36,
            quantityEditable: true,
            options: [
              option('waste-chute', 'Worktop chute with bin', 890, 907_072),
              option('waste-sorter', 'Two-way sorting frame', 1340, 907_073, {
                maxQuantity: 2,
              }),
            ],
          }),
        ],
      },
    ],
  };
}

function buildSections(): ConfigurationSection[] {
  return [
    {
      id: 'structure',
      name: 'Structure',
      sortIndex: 1,
      visible: true,
      messages: [],
      variables: [
        seedVariable({
          id: 'length',
          name: 'Length',
          sortIndex: 4,
          description: 'Outer length of the station.',
          value: 2400,
          defaultValue: 2400,
          min: 1200,
          max: 4000,
          step: 200,
          unit: 'mm',
        }),
        seedVariable({
          id: 'depth',
          name: 'Depth',
          sortIndex: 5,
          description: 'Outer depth of the station.',
          value: 900,
          defaultValue: 900,
          min: 700,
          max: 1200,
          step: 100,
          unit: 'mm',
        }),
        seedVariable({
          id: 'height',
          name: 'Working height',
          sortIndex: 6,
          description: 'Height from floor to the top of the worktop.',
          value: 900,
          defaultValue: 900,
          min: 750,
          max: 1100,
          step: 50,
          unit: 'mm',
        }),
      ],
      optionGroups: [
        seedGroup({
          id: 'frame',
          code: 'FRAME',
          name: 'Frame',
          sortIndex: 2,
          minSelections: 1,
          maxSelections: 1,
          options: [
            option('frame-welded', 'Welded steel frame', 0, 907_030, {
              selected: true,
              selectionSource: 'initial',
            }),
            option('frame-bolted', 'Bolted modular frame', 900, 907_031),
            option(
              'frame-adjustable',
              'Height-adjustable frame',
              5600,
              907_032,
            ),
          ],
        }),
        seedGroup({
          id: 'legs',
          code: 'LEGS',
          name: 'Leg pairs',
          sortIndex: 3,
          options: [
            option('legs-third', 'Third leg pair, centre', 1400, 907_033),
            option('legs-levelling', 'Levelling feet', 380, 907_034),
          ],
        }),
      ],
      sections: [worktopSection()],
    },
    {
      id: 'storage',
      name: 'Storage',
      sortIndex: 14,
      visible: true,
      sections: [],
      messages: [],
      variables: [
        seedVariable({
          id: 'shelves',
          name: 'Shelves',
          sortIndex: 21,
          description: 'Number of shelves under the worktop.',
          required: false,
          min: 0,
          max: 4,
          step: 1,
          unit: 'pcs',
        }),
      ],
      optionGroups: [
        seedGroup({
          id: 'drawers',
          code: 'DRAWERS',
          name: 'Drawer unit',
          sortIndex: 15,
          minSelections: 1,
          maxSelections: 1,
          options: [
            option('drawers-none', 'No drawer unit', 0, 907_040, {
              selected: true,
              selectionSource: 'initial',
            }),
            option('drawers-three', 'Three drawers', 2400, 907_041),
            option('drawers-six', 'Six drawers', 4100, 907_042),
          ],
          // One nested list under a group whose rows come first, which is the
          // shallow half of what the contract allows.
          optionGroups: [
            seedGroup({
              id: 'drawer-locks',
              code: 'DRAWER_LOCKS',
              name: 'Drawer locks',
              sortIndex: 16,
              options: [
                option('lock-keyed', 'Keyed lock', 340, 907_045),
                option('lock-code', 'Combination lock', 520, 907_046),
              ],
            }),
          ],
        }),
        seedGroup({
          id: 'bins',
          code: 'BINS',
          name: 'Small parts storage',
          sortIndex: 17,
          quantityEditable: true,
          options: [
            option('bin-rail', 'Louvre panel with bins', 1100, 907_043, {
              maxQuantity: 3,
            }),
            option('bin-tray', 'Pull-out parts tray', 640, 907_044, {
              maxQuantity: 4,
            }),
          ],
          // Three nested lists under one group, the deeper half: the rows
          // above come first, and the nested lists follow in their own order.
          optionGroups: [
            seedGroup({
              id: 'bin-small',
              code: 'BINS_SMALL',
              name: 'Small bins',
              sortIndex: 18,
              quantityEditable: true,
              options: [
                option('bin-s-blue', 'Small bin, blue', 45, 907_060, {
                  maxQuantity: 20,
                }),
                option('bin-s-red', 'Small bin, red', 45, 907_061, {
                  maxQuantity: 20,
                }),
              ],
            }),
            seedGroup({
              id: 'bin-medium',
              code: 'BINS_MEDIUM',
              name: 'Medium bins',
              sortIndex: 19,
              quantityEditable: true,
              options: [
                option('bin-m-blue', 'Medium bin, blue', 70, 907_062, {
                  maxQuantity: 12,
                }),
                option('bin-m-red', 'Medium bin, red', 70, 907_063, {
                  maxQuantity: 12,
                }),
              ],
            }),
            seedGroup({
              id: 'bin-large',
              code: 'BINS_LARGE',
              name: 'Large bins',
              sortIndex: 20,
              quantityEditable: true,
              options: [
                option('bin-l-blue', 'Large bin, blue', 95, 907_064, {
                  maxQuantity: 8,
                }),
                option('bin-l-red', 'Large bin, red', 95, 907_065, {
                  maxQuantity: 8,
                }),
              ],
            }),
          ],
        }),
      ],
    },
    {
      id: 'power',
      name: 'Power and lighting',
      sortIndex: 22,
      visible: true,
      sections: [],
      messages: [],
      variables: [
        seedVariable({
          id: 'sockets',
          name: 'Sockets',
          sortIndex: 25,
          description: 'Outlets on the power rail.',
          required: false,
          value: 4,
          defaultValue: 4,
          min: 0,
          max: 12,
          step: 2,
          unit: 'pcs',
        }),
      ],
      optionGroups: [
        seedGroup({
          id: 'supply',
          code: 'SUPPLY',
          name: 'Power supply',
          sortIndex: 23,
          minSelections: 1,
          maxSelections: 1,
          options: [
            option('supply-single', 'Single phase, 230 V', 0, 907_050, {
              selected: true,
              selectionSource: 'initial',
            }),
            option('supply-three', 'Three phase, 400 V', 3200, 907_051),
          ],
        }),
        seedGroup({
          id: 'lighting',
          code: 'LIGHTING',
          name: 'Lighting',
          sortIndex: 24,
          quantityEditable: true,
          options: [
            option('light-bar', 'LED light bar', 780, 907_052),
            option('light-task', 'Articulated task lamp', 1250, 907_053, {
              maxQuantity: 2,
            }),
          ],
        }),
      ],
    },
    logisticsSection(),
    accessoriesSection(),
  ];
}

/**
 * A station past three metres sags between two leg pairs, so the provider adds
 * the third itself and says why. The rule reaches from a variable in the first
 * section into a group beside it, the shallow direction; the worktop rule below
 * reaches down two levels, which is the one nesting makes possible.
 */
function longStationNeedsTheThirdLegPair(config: Configuration): void {
  if (numberOf(config, 'length') < THIRD_LEG_LENGTH) return;
  const third = findOption(config, 'legs-third');
  if (!third) return;
  third.selected = true;
  third.selectionSource = 'groupRule';
  third.messages = [
    {
      severity: 'warning',
      text: `A station of ${THIRD_LEG_LENGTH} mm or more carries a third leg pair.`,
    },
  ];
}

/**
 * Steel is welded to its own edge, so the trim group two levels down loses the
 * two profiles that would be glued to it. A selected option that goes
 * unavailable is cleared and the group falls back to the band that always fits
 * — the provider answers with a document that is still valid, never with an
 * empty required group.
 */
function steelTopRestrictsTheEdgeTrim(config: Configuration): void {
  if (findOption(config, 'top-steel')?.selected !== true) return;
  for (const id of ['edge-beech', 'edge-alu']) {
    const trim = findOption(config, id);
    if (!trim) continue;
    trim.available = false;
    trim.selected = false;
    trim.messages = [
      {
        severity: 'warning',
        text: 'A stainless steel top is supplied with its edge already formed.',
      },
    ];
  }
  const band = findOption(config, 'edge-abs');
  if (!band) return;
  band.selected = true;
  band.selectionSource = 'groupRule';
}

export const monteringsstationPro: Seed = {
  productId: MONTERINGSSTATION_PRO_ID,
  geinsProductId: MONTERINGSSTATION_PRO_GEINS_ID,
  templateId: `TPL-${ARTICLE}`,
  templateVersion: '1',
  basePrice: BASE_PRICE,
  weightPerUnit: 92,
  variableRates: {
    length: 1.8,
    depth: 1.2,
    height: 0.6,
    shelves: 520,
    sockets: 140,
    overhang: 3,
  },
  formulas: {
    'crate-volume': (config) =>
      Math.round(
        ((numberOf(config, 'length') + 120) *
          (numberOf(config, 'depth') + 120) *
          400 *
          10) /
          LITRES_PER_CUBIC_MM,
      ) / 10,
  },
  cascades: [longStationNeedsTheThirdLegPair, steelTopRestrictsTheEdgeTrim],
  buildSections,
};

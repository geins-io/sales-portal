import type {
  Configuration,
  ConfigurationOption,
  ConfigurationSection,
} from '#shared/types/configurator';
import { findVariable } from '../document';
import { seedGroup, seedOption, seedVariable } from './builders';
import type { Seed } from './types';

// ---------------------------------------------------------------------------
// "Skåpsektion Pro", article KONF-1002 — a small second product that exists
// for the three document states the workbench never reaches: a section the UI
// must not render, a variable the provider computes and the buyer cannot set,
// and an option row that is selected and cannot be changed. The CPQ mock seeds
// a second product for the same reason.
//
// Its two visible sections are siblings, where the workbench nests one inside
// the other: between them the two seeds show the rail both ways.
//
// No rules: what is being exercised here is how a state renders, not how it
// comes about.
//
// The Cabinet section interleaves its fields between its two option lists, so
// the component tests that mount it measure the merge and not one list after
// the other.
// ---------------------------------------------------------------------------

export const SKAPSEKTION_PRO_ID = '900000000000124';

/** The catalogue product on the team tenant, alias `skapsektion-pro`. */
export const SKAPSEKTION_PRO_GEINS_ID = '1102';

const ARTICLE = 'KONF-1002';
const BASE_PRICE = 5400;
const CATEGORY = 'Cabinets';
const VAT_RATE = 25;

const SQUARE_MM_PER_SQUARE_M = 1_000_000;

function option(
  id: string,
  name: string,
  net: number,
  productId: number,
  overrides: Partial<ConfigurationOption> = {},
): ConfigurationOption {
  return seedOption(
    {
      id,
      name,
      net,
      productId,
      article: ARTICLE,
      category: CATEGORY,
      vatRate: VAT_RATE,
    },
    overrides,
  );
}

function numberOf(config: Configuration, id: string): number {
  const value = findVariable(config, id)?.value;
  return typeof value === 'number' ? value : 0;
}

function buildSections(): ConfigurationSection[] {
  return [
    {
      id: 'cabinet',
      name: 'Cabinet',
      sortIndex: 1,
      description: '',
      visible: true,
      sections: [],
      messages: [],
      variables: [
        seedVariable({
          id: 'cab-width',
          name: 'Width',
          sortIndex: 3,
          description: 'Outer width of the cabinet.',
          value: 800,
          defaultValue: 800,
          min: 600,
          max: 1200,
          step: 100,
          unit: 'mm',
        }),
        seedVariable({
          id: 'cab-height',
          name: 'Height',
          sortIndex: 4,
          description: 'Outer height of the cabinet.',
          value: 2000,
          defaultValue: 2000,
          min: 1800,
          max: 2400,
          step: 200,
          unit: 'mm',
        }),
        seedVariable({
          id: 'front-area',
          name: 'Front area',
          sortIndex: 6,
          description: 'Painted area, computed from the outer dimensions.',
          required: false,
          decimals: 2,
          unit: 'm²',
          // The provider owns the value and says so twice: the value came from
          // a formula, and the row is not the buyer's to set.
          valueSource: 'formula',
          selectionSource: 'locked',
        }),
      ],
      optionGroups: [
        seedGroup({
          id: 'mount',
          code: 'MOUNT',
          name: 'Mounting',
          sortIndex: 2,
          minSelections: 1,
          maxSelections: 1,
          options: [
            option('mount-wall', 'Wall mounting rail', 450, 906_001, {
              selected: true,
              selectionSource: 'locked',
              messages: [
                {
                  severity: 'warning',
                  text: 'This cabinet is always wall mounted.',
                },
              ],
            }),
          ],
        }),
        seedGroup({
          id: 'doors',
          code: 'DOORS',
          name: 'Doors',
          sortIndex: 5,
          minSelections: 1,
          maxSelections: 1,
          options: [
            option('door-glass', 'Glass doors', 0, 906_002, {
              selected: true,
              selectionSource: 'initial',
            }),
            option('door-steel', 'Steel doors', 800, 906_003),
          ],
        }),
      ],
    },
    {
      // A second visible top-level section, so one seed shows siblings while
      // the workbench shows depth. One option arrives selected: a group that
      // required a choice and had none would make the document invalid on
      // create, which is not what this seed is here to show.
      id: 'interior',
      name: 'Interior',
      sortIndex: 7,
      description: '',
      visible: true,
      sections: [],
      messages: [],
      variables: [],
      optionGroups: [
        seedGroup({
          id: 'shelving',
          code: 'SHELVING',
          name: 'Shelving',
          sortIndex: 8,
          minSelections: 1,
          maxSelections: 1,
          options: [
            option('shelf-3', 'Three shelves', 0, 906_004, {
              selected: true,
              selectionSource: 'initial',
            }),
            option('shelf-5', 'Five shelves', 600, 906_005),
          ],
        }),
        seedGroup({
          id: 'interior-extras',
          code: 'INTERIOR_EXTRAS',
          name: 'Interior extras',
          sortIndex: 9,
          quantityEditable: true,
          options: [
            option('int-drawer', 'Drawer unit', 1200, 906_006, {
              maxQuantity: 3,
            }),
            option('int-divider', 'Shelf divider', 180, 906_007, {
              maxQuantity: 6,
            }),
          ],
        }),
      ],
    },
    {
      // Warehouse data the provider keeps on the document. The UI hides a
      // section that arrives invisible rather than deciding for itself what a
      // buyer should not see.
      id: 'logistics',
      name: 'Logistics',
      sortIndex: 10,
      description: '',
      visible: false,
      sections: [],
      optionGroups: [],
      messages: [],
      variables: [
        seedVariable({
          id: 'pallet-code',
          name: 'Pallet code',
          sortIndex: 11,
          description: 'Packaging the cabinet ships on.',
          valueType: 'string',
          value: 'PAL-80',
          defaultValue: 'PAL-80',
          required: false,
        }),
      ],
    },
  ];
}

export const skapsektionPro: Seed = {
  productId: SKAPSEKTION_PRO_ID,
  geinsProductId: SKAPSEKTION_PRO_GEINS_ID,
  templateId: `TPL-${ARTICLE}`,
  templateVersion: '2',
  basePrice: BASE_PRICE,
  vatRate: VAT_RATE,
  weightPerUnit: 64,
  variableRates: { 'cab-width': 2, 'cab-height': 1.5 },
  formulas: {
    'front-area': (config) =>
      Math.round(
        (numberOf(config, 'cab-width') * numberOf(config, 'cab-height') * 100) /
          SQUARE_MM_PER_SQUARE_M,
      ) / 100,
  },
  cascades: [],
  buildSections,
};

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
// No rules: what is being exercised here is how a state renders, not how it
// comes about.
// ---------------------------------------------------------------------------

export const SKAPSEKTION_PRO_ID = '900000000000124';

/** The catalogue product on the team tenant, alias `skapsektion-pro`. */
export const SKAPSEKTION_PRO_GEINS_ID = '1102';

const ARTICLE = 'KONF-1002';
const BASE_PRICE = 5400;
const CATEGORY = 'Cabinets';

const SQUARE_MM_PER_SQUARE_M = 1_000_000;

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

function buildSections(): ConfigurationSection[] {
  return [
    {
      id: 'cabinet',
      name: 'Cabinet',
      visible: true,
      sections: [],
      messages: [],
      variables: [
        seedVariable({
          id: 'cab-width',
          name: 'Width',
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
      // Warehouse data the provider keeps on the document. The UI hides a
      // section that arrives invisible rather than deciding for itself what a
      // buyer should not see.
      id: 'logistics',
      name: 'Logistics',
      visible: false,
      sections: [],
      optionGroups: [],
      messages: [],
      variables: [
        seedVariable({
          id: 'pallet-code',
          name: 'Pallet code',
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

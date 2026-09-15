import type { ListProduct } from '#shared/types/commerce';
import type {
  Configuration,
  CreateConfigurationInput,
  Money,
} from '#shared/types/configurator';
import type { ConfiguratorBackend, ConfiguratorContext } from '../configurator';

// ---------------------------------------------------------------------------
// Fixture backend — stub.
//
// The seam and its switch land before the engine, so this module exists to
// give `configurator.backend=fixture` something to answer with. The engine
// ticket replaces the internals and keeps the export; nothing above the seam
// changes. No Geins SDK import belongs here.
// ---------------------------------------------------------------------------

/** How long a session the stub hands out lives. */
const SESSION_MINUTES = 30;

const CURRENCY = 'SEK';

function money(net: number): Money {
  return { net, currency: CURRENCY };
}

function stubProduct(): ListProduct {
  return {
    productId: 1,
    name: 'Fixture option',
    alias: 'fixture-option',
    canonicalUrl: '/products/fixture-option',
    articleNumber: 'FIXTURE-1',
    brand: { name: 'Fixture' },
    primaryCategory: { name: 'Fixture' },
    unitPrice: {
      sellingPriceIncVat: 1250,
      sellingPriceIncVatFormatted: '1 250 kr',
      isDiscounted: false,
    },
    productImages: [],
    totalStock: { inStock: 10, oversellable: 0, totalStock: 10, static: 0 },
    skus: [],
    discountCampaigns: [],
  };
}

function stubConfiguration(input: CreateConfigurationInput): Configuration {
  return {
    configurationId: `fixture-${Date.now()}`,
    expiresAt: new Date(Date.now() + SESSION_MINUTES * 60_000).toISOString(),
    isValid: true,
    productId: input.productId,
    quantity: input.quantity,
    unitPrice: money(1000),
    discountPercent: 0,
    templateId: 'fixture-template',
    templateVersion: '1',
    messages: [],
    sections: [
      {
        id: 'section-1',
        name: 'Fixture section',
        visible: true,
        sections: [],
        variables: [
          {
            id: 'variable-1',
            name: 'Fixture variable',
            description: '',
            valueType: 'number',
            value: 1,
            defaultValue: 1,
            required: false,
            available: true,
            selectionSource: 'none',
            valueSource: 'initial',
            messages: [],
          },
        ],
        optionGroups: [
          {
            id: 'group-1',
            code: 'fixture-group',
            name: 'Fixture group',
            available: true,
            maxSelections: 1,
            quantityEditable: false,
            optionGroups: [],
            options: [
              {
                id: 'option-1',
                instanceId: 'option-1-1',
                productId: '1',
                selected: false,
                available: true,
                selectionSource: 'none',
                quantity: 1,
                defaultQuantity: 1,
                unitPrice: money(1250),
                discountPercent: 0,
                messages: [],
                product: stubProduct(),
              },
            ],
            messages: [],
          },
        ],
        messages: [],
      },
    ],
  };
}

/** What the engine ticket has not replaced yet. */
async function notYetImplemented(): Promise<never> {
  throw createAppError(
    ErrorCode.NOT_FOUND,
    'The configurator fixture holds no sessions yet',
  );
}

export const fixtureConfiguratorBackend: ConfiguratorBackend = {
  async create(
    input: CreateConfigurationInput,
    _ctx: ConfiguratorContext,
  ): Promise<Configuration> {
    return stubConfiguration(input);
  },
  get: notYetImplemented,
  applyChanges: notYetImplemented,
  renew: notYetImplemented,
  release: notYetImplemented,
  commit: notYetImplemented,
};

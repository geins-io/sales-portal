import type { Configuration } from '#shared/types/configurator';
import type {
  ConfiguratorBackend,
  ConfiguratorContext,
  MerchantApiTarget,
} from '../configurator';
import { loadQuery } from '../graphql/loader';
import { requestMerchantApi } from './client';
import { mapConfiguration } from './map';
import type { WireConfiguration } from './wire';

// ---------------------------------------------------------------------------
// The real backend: the CPQ area of merchant-api, over GraphQL.
//
// Create and read land here; the change batch, renew, release and commit land
// with the tickets that build them on the page.
// ---------------------------------------------------------------------------

/** A Geins product id: a positive integer, as the create mutation's `Int`. */
const PRODUCT_ID = /^[1-9]\d*$/;

function targetOf(ctx: ConfiguratorContext): MerchantApiTarget {
  if (!ctx.merchantApi) {
    throw createAppError(
      ErrorCode.INTERNAL_ERROR,
      'The configurator context carries no merchant-api target',
    );
  }
  return ctx.merchantApi;
}

function channelOf({ channelId, languageId, marketId }: MerchantApiTarget) {
  return { channelId, languageId, marketId };
}

function documentOf(wire: WireConfiguration | null): Configuration {
  if (!wire) {
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      'The configurator backend answered without a document',
    );
  }
  return mapConfiguration(wire);
}

export function createMerchantApiConfiguratorBackend(): ConfiguratorBackend {
  const later = async (): Promise<never> => {
    throw createAppError(
      ErrorCode.NOT_IMPLEMENTED,
      'Not on the merchant-api configurator backend yet',
    );
  };

  return {
    isConfigurable: ({ type }) => type === 'configurable',

    async create(input, ctx) {
      const target = targetOf(ctx);
      if (!PRODUCT_ID.test(input.productId)) {
        throw createAppError(
          ErrorCode.NOT_FOUND,
          `'${input.productId}' is not a Geins product id`,
        );
      }
      const data = await requestMerchantApi<{
        createConfiguration: WireConfiguration | null;
      }>(
        target,
        ctx.userToken,
        loadQuery('configurator/create-configuration.graphql'),
        {
          productId: Number(input.productId),
          quantity: input.quantity,
          ...channelOf(target),
        },
      );
      return documentOf(data.createConfiguration);
    },

    async get(id, ctx) {
      const target = targetOf(ctx);
      const data = await requestMerchantApi<{
        getConfiguration: WireConfiguration | null;
      }>(
        target,
        ctx.userToken,
        loadQuery('configurator/get-configuration.graphql'),
        { configurationId: id, ...channelOf(target) },
      );
      return documentOf(data.getConfiguration);
    },

    applyChanges: later,
    renew: later,
    release: later,
    commit: later,
  };
}

/** The instance the seam hands out. */
export const merchantApiConfiguratorBackend: ConfiguratorBackend =
  createMerchantApiConfiguratorBackend();

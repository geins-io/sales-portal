import type { Configuration } from '#shared/types/configurator';
import type {
  ConfiguratorBackend,
  ConfiguratorContext,
  MerchantApiTarget,
} from '../configurator';
import { loadQuery } from '../graphql/loader';
import { toWireChange } from './changes';
import { requestMerchantApi } from './client';
import { mapCommittedConfiguration, mapConfiguration } from './map';
import type { WireCommittedConfiguration, WireConfiguration } from './wire';

// ---------------------------------------------------------------------------
// The real backend: the CPQ area of merchant-api, over GraphQL.
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

function upstream(reason: string) {
  return createAppError(
    ErrorCode.EXTERNAL_API_ERROR,
    `The configurator backend ${reason}`,
  );
}

function documentOf(wire: WireConfiguration | null): Configuration {
  if (!wire) throw upstream('answered without a document');
  return mapConfiguration(wire);
}

export function createMerchantApiConfiguratorBackend(): ConfiguratorBackend {
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

    async applyChanges(id, changes, ctx) {
      const target = targetOf(ctx);
      const data = await requestMerchantApi<{
        applyConfigurationChanges: WireConfiguration | null;
      }>(
        target,
        ctx.userToken,
        loadQuery('configurator/apply-configuration-changes.graphql'),
        {
          configurationId: id,
          changes: changes.map(toWireChange),
          ...channelOf(target),
        },
      );
      return documentOf(data.applyConfigurationChanges);
    },

    async renew(id, ctx) {
      const target = targetOf(ctx);
      const data = await requestMerchantApi<{
        renewConfiguration: { expiresAt: string } | null;
      }>(
        target,
        ctx.userToken,
        loadQuery('configurator/renew-configuration.graphql'),
        { configurationId: id, ...channelOf(target) },
      );
      if (!data.renewConfiguration)
        throw upstream('answered without an expiry');
      return { expiresAt: data.renewConfiguration.expiresAt };
    },

    async release(id, ctx) {
      const target = targetOf(ctx);
      const data = await requestMerchantApi<{
        deleteConfiguration: boolean | null;
      }>(
        target,
        ctx.userToken,
        loadQuery('configurator/delete-configuration.graphql'),
        { configurationId: id, ...channelOf(target) },
      );
      if (data.deleteConfiguration !== true) {
        throw upstream('answered that nothing was released');
      }
    },

    async commit(id, ctx) {
      const target = targetOf(ctx);
      const data = await requestMerchantApi<{
        commitConfiguration: WireCommittedConfiguration | null;
      }>(
        target,
        ctx.userToken,
        loadQuery('configurator/commit-configuration.graphql'),
        { configurationId: id, ...channelOf(target) },
      );
      if (!data.commitConfiguration) {
        throw upstream('answered without a committed configuration');
      }
      return mapCommittedConfiguration(data.commitConfiguration, id);
    },
  };
}

/** The instance the seam hands out. */
export const merchantApiConfiguratorBackend: ConfiguratorBackend =
  createMerchantApiConfiguratorBackend();

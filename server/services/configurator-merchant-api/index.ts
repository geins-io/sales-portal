import type { Configuration } from '#shared/types/configurator';
import type {
  ConfiguratorBackend,
  ConfiguratorContext,
  MerchantApiTarget,
} from '../configurator';
import { loadQuery } from '../graphql/loader';
import { toWireChange } from './changes';
import {
  LINE_READ_TIMEOUT_MS,
  REOPEN_TIMEOUT_MS,
  requestMerchantApi,
} from './client';
import {
  mapCartLineConfigurations,
  mapCommittedConfiguration,
  mapConfiguration,
  mapOrderLineConfigurations,
} from './map';
import type {
  WireCartLines,
  WireCommittedConfiguration,
  WireConfiguration,
  WireOrderLines,
} from './wire';

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

async function readCartLines(cartId: string, ctx: ConfiguratorContext) {
  const target = targetOf(ctx);
  const data = await requestMerchantApi<{ getCart: WireCartLines | null }>(
    target,
    ctx.userToken,
    loadQuery('configurator/get-cart-line-configurations.graphql'),
    { id: cartId, ...channelOf(target) },
    { timeoutMs: LINE_READ_TIMEOUT_MS },
  );
  return data.getCart;
}

async function cartLines(cartId: string, ctx: ConfiguratorContext) {
  return mapCartLineConfigurations(await readCartLines(cartId, ctx));
}

async function orderLines(publicOrderId: string, ctx: ConfiguratorContext) {
  const target = targetOf(ctx);
  const data = await requestMerchantApi<{
    getOrderPublic: WireOrderLines | null;
  }>(
    target,
    ctx.userToken,
    loadQuery('configurator/get-order-line-configurations.graphql'),
    { publicOrderId, ...channelOf(target) },
    { timeoutMs: LINE_READ_TIMEOUT_MS },
  );
  return mapOrderLineConfigurations(data.getOrderPublic);
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

    async addToCart(cartId, line, ctx) {
      const target = targetOf(ctx);
      // A retry after an answer lost on the way would add the committed id
      // again, and one id added twice is two lines. A failed read fails the add.
      for (const [itemId, { configurationId }] of await cartLines(
        cartId,
        ctx,
      )) {
        if (configurationId === line.committedConfigurationId) {
          return { itemId };
        }
      }
      const data = await requestMerchantApi<{
        addToCart: {
          items?:
            | ({ id: string; configurationId?: string | null } | null)[]
            | null;
        } | null;
      }>(
        target,
        ctx.userToken,
        loadQuery('configurator/add-configured-cart-item.graphql'),
        {
          id: cartId,
          item: {
            skuId: line.skuId,
            quantity: line.quantity,
            configurationId: line.committedConfigurationId,
          },
          ...channelOf(target),
        },
      );
      // A line short of stock is dropped with a 200 and no error.
      const added = (data.addToCart?.items ?? []).find(
        (item) => item?.configurationId === line.committedConfigurationId,
      );
      if (!added) {
        throw createAppError(
          ErrorCode.CONFLICT,
          'The configured line was not added',
        );
      }
      return { itemId: added.id };
    },

    cartLineConfigurations: cartLines,
    orderLineConfigurations: orderLines,

    async replaceLine(cartId, itemId, committedConfigurationId, ctx) {
      const target = targetOf(ctx);
      // The quantity is the line's as it is now, not the session's. A failed
      // read fails the swap, which leaves the line as it was.
      const line = (await readCartLines(cartId, ctx))?.items?.find(
        (item) => item?.id === itemId,
      );
      if (!line) {
        throw createAppError(ErrorCode.CART_LINE_GONE, 'The cart line is gone');
      }
      // A retry after an answer lost on the way finds the swap already made.
      if (line.configurationId === committedConfigurationId) return { itemId };
      // Sent upstream, a missing quantity would be the provider's to guess.
      if (line.quantity === null) {
        throw createAppError(
          ErrorCode.CONFLICT,
          'The cart line has no quantity',
        );
      }

      const data = await requestMerchantApi<{
        updateCartItem: {
          items?:
            | ({ id: string; configurationId?: string | null } | null)[]
            | null;
        } | null;
      }>(
        target,
        ctx.userToken,
        loadQuery('configurator/update-configured-cart-item.graphql'),
        {
          id: cartId,
          item: {
            id: itemId,
            quantity: line.quantity,
            configurationId: committedConfigurationId,
          },
          ...channelOf(target),
        },
      );
      // Only the same line carrying the new id is a swap; anything else could
      // be a second line passing as one.
      const swapped = (data.updateCartItem?.items ?? []).some(
        (item) =>
          item?.id === itemId &&
          item.configurationId === committedConfigurationId,
      );
      if (!swapped) {
        throw createAppError(ErrorCode.CONFLICT, 'The line was not updated');
      }
      return { itemId };
    },

    async reopen(cartId, itemId, ctx) {
      const target = targetOf(ctx);
      const data = await requestMerchantApi<{
        reopenCartItemConfiguration: WireConfiguration | null;
      }>(
        target,
        ctx.userToken,
        loadQuery('configurator/reopen-cart-item-configuration.graphql'),
        { cartId, itemId, ...channelOf(target) },
        { timeoutMs: REOPEN_TIMEOUT_MS },
      );
      return documentOf(data.reopenCartItemConfiguration);
    },
  };
}

/** The instance the seam hands out. */
export const merchantApiConfiguratorBackend: ConfiguratorBackend =
  createMerchantApiConfiguratorBackend();

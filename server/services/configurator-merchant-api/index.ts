import { isConfigurationError } from '@geins/core';
import type {
  ConfigurationCallOptions,
  ConfigurationType,
  RequestContext,
} from '@geins/types';
import type { Configuration } from '#shared/types/configurator';
import { logger } from '../../utils/logger';
import type {
  ConfiguratorBackend,
  ConfiguratorContext,
  ConfiguratorSdk,
} from '../configurator';
import { toWireChange } from './changes';
import {
  mapCartLineConfigurations,
  mapCommittedConfiguration,
  mapConfiguration,
  mapOrderLineChoices,
  mapOrderLineConfigurations,
} from './map';

// ---------------------------------------------------------------------------
// The real backend: the CPQ area of merchant-api, through the SDK's
// configuration service. The SDK sends no call twice and keeps none in its
// cache; the rules below are the portal's.
// ---------------------------------------------------------------------------

/** Measured 1–3 s per canary round trip; a hung request fails well after. */
const TIMEOUT_MS = 15_000;

/**
 * The read of a cart's lines or an order's rows; a cart's measured at 60–300 ms
 * warm and about 400 ms cold. Past this the cart or the order answers without
 * their configurations, and a configured add, which reads the lines first,
 * fails rather than risk a second line.
 */
export const LINE_READ_TIMEOUT_MS = 2_000;

/**
 * A reopen replays the session's change log, measured at 2 s for one change
 * and 17 s for forty. The provider gives up itself at about 35 s with a 503, so
 * this waits past that and the provider's answer always arrives first.
 */
export const REOPEN_TIMEOUT_MS = 45_000;

/** A Geins product id: a positive integer, as the create mutation's `Int`. */
const PRODUCT_ID = /^[1-9]\d*$/;

/** The provider's codes the portal answers with its own status. */
function knownFailure(code: string) {
  switch (code) {
    case 'ConfigurationNotFound':
      return createAppError(ErrorCode.NOT_FOUND, 'No such configuration');
    case 'ConfigurationGone':
      return createAppError(ErrorCode.GONE, 'The configuration is finished');
    case 'MissingCustomerNumber':
      return createAppError(
        ErrorCode.FORBIDDEN,
        "The buyer's company has no customer number",
      );
    case 'ConfigurationFailed':
      return createAppError(
        ErrorCode.VALIDATION_ERROR,
        'The provider rejected the change',
      );
    case 'ConfigurationMismatch':
      return createAppError(
        ErrorCode.VALIDATION_ERROR,
        'The committed configuration is not for this article',
      );
    // Two codes, because a signed-in buyer of another company must not be
    // told to sign in.
    case 'LoginRequired':
      return createAppError(
        ErrorCode.UNAUTHORIZED,
        'The cart needs a signed-in buyer',
      );
    case 'ConfigurationNotReopenable':
      return createAppError(
        ErrorCode.VALIDATION_ERROR,
        'The configuration cannot be reopened',
      );
    case 'CartItemNotConfigured':
      return createAppError(
        ErrorCode.CART_LINE_GONE,
        'The cart line carries no configuration',
      );
    case 'CartBelongsToAnotherCompany':
      return createAppError(
        ErrorCode.CART_NOT_OWN,
        "The cart is another company's",
      );
    case 'NotAvailable':
      return createAppError(
        ErrorCode.CONFIGURATOR_NOT_AVAILABLE,
        'The account has no configurator',
      );
    // The session's currency is fixed at its start; a market in another one
    // is refused on every later call, the cart's included.
    case 'ConfigurationCurrencyMismatch':
      return createAppError(
        ErrorCode.CURRENCY_MISMATCH,
        'The configuration is priced in another currency',
      );
    case 'ProductNotFound':
    case 'InvalidProductReference':
      return createAppError(
        ErrorCode.NOT_FOUND,
        'The product is not known to the configurator',
      );
    default:
      return undefined;
  }
}

function upstream(reason: string) {
  return createAppError(
    ErrorCode.EXTERNAL_API_ERROR,
    `The configurator backend ${reason}`,
  );
}

/**
 * The portal's answer to a failed call. Nothing the SDK throws is passed on or
 * logged as it is: its cause carries the request, URL included.
 */
function failure(error: unknown) {
  if (!isConfigurationError(error)) {
    return upstream('could not be reached');
  }
  for (const { code, message } of error.providerErrors) {
    const known = code === undefined ? undefined : knownFailure(code);
    if (!known) continue;
    // The reason names the change the provider refused ("Variable … is
    // read-only"). The buyer gets the page's form error; the reason is logged.
    if (code === 'ConfigurationFailed') {
      logger.warn(`[configurator] ${code}: ${message}`);
    }
    return known;
  }
  if (error.status === undefined && error.providerErrors.length === 0) {
    return upstream('could not be reached');
  }
  return upstream(
    `answered ${error.status ?? 'with errors'}, codes [${error.providerCodes.join(', ')}]`,
  );
}

function sdkOf(ctx: ConfiguratorContext): ConfiguratorSdk {
  if (!ctx.sdk) {
    throw createAppError(
      ErrorCode.INTERNAL_ERROR,
      'The configurator context carries no SDK',
    );
  }
  return ctx.sdk;
}

/**
 * One call to the configuration service, as the request's buyer, in its
 * channel. Every failure is answered with the portal's own error.
 */
async function call<T>(
  ctx: ConfiguratorContext,
  send: (
    service: ConfiguratorSdk['configuration'],
    requestContext: RequestContext,
    options: ConfigurationCallOptions,
  ) => Promise<T>,
  { timeoutMs = TIMEOUT_MS }: ConfigurationCallOptions = {},
): Promise<T> {
  const { configuration, channel } = sdkOf(ctx);
  try {
    return await send(
      configuration,
      { ...channel, ...(ctx.userToken ? { userToken: ctx.userToken } : {}) },
      { timeoutMs },
    );
  } catch (error) {
    throw failure(error);
  }
}

function documentOf(document: ConfigurationType | null): Configuration {
  if (!document) throw upstream('answered without a document');
  return mapConfiguration(document);
}

function readCartLines(cartId: string, ctx: ConfiguratorContext) {
  return call(
    ctx,
    (service, requestContext, options) =>
      service.getCartLines(cartId, requestContext, options),
    { timeoutMs: LINE_READ_TIMEOUT_MS },
  );
}

async function cartLines(cartId: string, ctx: ConfiguratorContext) {
  const cart = await readCartLines(cartId, ctx);
  // The copy at sign-in reads no lines as "nothing configured", so a cart this
  // read cannot see must fail rather than look empty.
  if (!cart) throw upstream('answered without the cart');
  return mapCartLineConfigurations(cart);
}

async function orderLines(publicOrderId: string, ctx: ConfiguratorContext) {
  const order = await call(
    ctx,
    (service, requestContext, options) =>
      service.getOrderLines(publicOrderId, requestContext, options),
    { timeoutMs: LINE_READ_TIMEOUT_MS },
  );
  // Reorder reads no rows as "nothing configured", so an order this read
  // cannot see must fail rather than look empty.
  if (!order) throw upstream('answered without the order');
  return mapOrderLineConfigurations(order);
}

async function orderLineChoices(
  publicOrderId: string,
  row: number,
  ctx: ConfiguratorContext,
) {
  const order = await call(
    ctx,
    (service, requestContext, options) =>
      service.getOrderLineChoices(publicOrderId, requestContext, options),
    { timeoutMs: LINE_READ_TIMEOUT_MS },
  );
  return mapOrderLineChoices(order, row);
}

export function createMerchantApiConfiguratorBackend(): ConfiguratorBackend {
  return {
    isConfigurable: ({ type }) => type === 'configurable',

    async create(input, ctx) {
      sdkOf(ctx);
      if (!PRODUCT_ID.test(input.productId)) {
        throw createAppError(
          ErrorCode.NOT_FOUND,
          `'${input.productId}' is not a Geins product id`,
        );
      }
      return documentOf(
        await call(ctx, (service, requestContext, options) =>
          service.create(
            { productId: Number(input.productId), quantity: input.quantity },
            requestContext,
            options,
          ),
        ),
      );
    },

    async get(id, ctx) {
      return documentOf(
        await call(ctx, (service, requestContext, options) =>
          service.get(id, requestContext, options),
        ),
      );
    },

    async applyChanges(id, changes, ctx) {
      return documentOf(
        await call(ctx, (service, requestContext, options) =>
          service.applyChanges(
            id,
            changes.map(toWireChange),
            requestContext,
            options,
          ),
        ),
      );
    },

    async renew(id, ctx) {
      const renewal = await call(ctx, (service, requestContext, options) =>
        service.renew(id, requestContext, options),
      );
      if (!renewal) throw upstream('answered without an expiry');
      return { expiresAt: renewal.expiresAt };
    },

    async release(id, ctx) {
      const released = await call(ctx, (service, requestContext, options) =>
        service.delete(id, requestContext, options),
      );
      if (released !== true) {
        throw upstream('answered that nothing was released');
      }
    },

    async commit(id, ctx) {
      const committed = await call(ctx, (service, requestContext, options) =>
        service.commit(id, requestContext, options),
      );
      if (!committed) {
        throw upstream('answered without a committed configuration');
      }
      return mapCommittedConfiguration(committed, id);
    },

    async addToCart(cartId, line, ctx) {
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
      const cart = await call(ctx, (service, requestContext, options) =>
        service.addCartItem(
          cartId,
          {
            skuId: line.skuId,
            quantity: line.quantity,
            configurationId: line.committedConfigurationId,
          },
          requestContext,
          options,
        ),
      );
      // A line short of stock is dropped with a 200 and no error.
      const added = (cart?.items ?? []).find(
        (item) => item.configurationId === line.committedConfigurationId,
      );
      if (!added?.id) {
        throw createAppError(
          ErrorCode.CONFLICT,
          'The configured line was not added',
        );
      }
      return { itemId: added.id };
    },

    cartLineConfigurations: cartLines,
    orderLineConfigurations: orderLines,
    orderLineChoices,

    async replaceLine(cartId, itemId, committedConfigurationId, ctx, quantity) {
      // Without a quantity given, the line's as it is now, not the session's. A
      // failed read fails the swap, which leaves the line as it was.
      const line = (await readCartLines(cartId, ctx))?.items.find(
        (item) => item.id === itemId,
      );
      if (!line) {
        throw createAppError(ErrorCode.CART_LINE_GONE, 'The cart line is gone');
      }
      // A retry after an answer lost on the way finds the swap already made.
      if (line.configurationId === committedConfigurationId) return { itemId };
      // Sent upstream, a missing quantity would be the provider's to guess.
      const sent = quantity ?? line.quantity;
      if (sent === null) {
        throw createAppError(
          ErrorCode.CONFLICT,
          'The cart line has no quantity',
        );
      }

      const cart = await call(ctx, (service, requestContext, options) =>
        service.updateCartItem(
          cartId,
          {
            id: itemId,
            quantity: sent,
            configurationId: committedConfigurationId,
          },
          requestContext,
          options,
        ),
      );
      // Only the same line carrying the new id is a swap; anything else could
      // be a second line passing as one.
      const swapped = (cart?.items ?? []).some(
        (item) =>
          item.id === itemId &&
          item.configurationId === committedConfigurationId,
      );
      if (!swapped) {
        throw createAppError(ErrorCode.CONFLICT, 'The line was not updated');
      }
      return { itemId };
    },

    async reopen(cartId, itemId, ctx) {
      return documentOf(
        await call(
          ctx,
          (service, requestContext, options) =>
            service.reopenCartItem(cartId, itemId, requestContext, options),
          { timeoutMs: REOPEN_TIMEOUT_MS },
        ),
      );
    },
  };
}

/** The instance the seam hands out. */
export const merchantApiConfiguratorBackend: ConfiguratorBackend =
  createMerchantApiConfiguratorBackend();

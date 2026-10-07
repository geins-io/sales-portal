import type { H3Event } from 'h3';
import type {
  CartLineConfiguration,
  OrderLineRead,
} from '#shared/types/commerce';
import type {
  CommittedConfiguration,
  Configuration,
  ConfigurationChange,
  ConfigurationChoices,
  CreateConfigurationInput,
} from '#shared/types/configurator';
import type { GeinsOMS } from '@geins/oms';
import { getRequestChannelVariables, getTenantSDK } from './_sdk';
import { createCompositeConfiguratorBackend } from './configurator-composite';
import { readConfiguratorBackendValue } from './configurator-config';
import { fixtureConfiguratorBackend } from './configurator-fixture';
import { merchantApiConfiguratorBackend } from './configurator-merchant-api';
import { withoutRestatedRequirements } from './configurator-messages';

// ---------------------------------------------------------------------------
// The seam between the portal and whatever produces a configuration.
//
// Routes and UI never learn which implementation answered. The real backend
// reaches the CPQ area through the Geins SDK's configuration service.
// ---------------------------------------------------------------------------

/**
 * What a backend needs from the request. It plays the role the `H3Event` plays
 * in the other services, so no implementation below the seam reaches into the
 * event itself.
 */
export interface ConfiguratorContext {
  hostname: string;
  userToken?: string;
  /**
   * Set on the configuration routes only. The product route asks
   * `isConfigurable` with the narrow context, which never reaches the wire.
   */
  sdk?: ConfiguratorSdk;
  /**
   * Set on the cart routes only: the portal's ordinary cart writes, for a
   * backend with no configured cart behind it.
   */
  cart?: PlainCart;
}

export interface PlainCart {
  /** Answers the cart, so the caller can tell which line the SKU landed on. */
  addPlainItem(
    cartId: string,
    item: { skuId: number; quantity: number },
  ): Promise<{ items?: { id?: string; skuId?: number | null }[] | null }>;
  /** Set where a configured line's quantity can change. */
  updatePlainItem?(
    cartId: string,
    item: { id: string; quantity: number },
  ): Promise<unknown>;
}

/** A committed configuration as a cart line: the SKU it is sold as, and how many. */
export interface ConfiguredCartLine {
  committedConfigurationId: string;
  skuId: number;
  quantity: number;
}

/** What a configured order row was committed with, and for which product. */
export interface OrderLineChoices extends ConfigurationChoices {
  productId: number | null;
}

/** What the merchant-api backend asks through: the tenant's SDK, and the request's channel. */
export interface ConfiguratorSdk {
  configuration: GeinsOMS['configuration'];
  channel: { channelId: string; languageId: string; marketId: string };
}

/**
 * The catalogue product the configurable question is asked about: its Geins
 * product id, and the product's own `type` as the merchant API sends it
 * (`"configurable"` when the Monitor sync stamped it, `"product"` otherwise).
 */
export interface ConfigurableCandidate {
  productId: string;
  type?: string | null;
}

export interface ConfiguratorBackend {
  /**
   * Whether this backend configures the given catalogue product. Asked of a
   * product being described, not of a request to configure one, so it answers
   * rather than throws. It takes the context like every other method: a Geins
   * product id belongs to one account, so an implementation that asks the
   * platform has to know which tenant is asking.
   *
   * The product's `type` is passed, not acted on here: a backend that cannot
   * configure (production's `off`) must answer no for a `"configurable"`
   * product too, or the page would dispatch to a configurator that fails.
   */
  isConfigurable(
    product: ConfigurableCandidate,
    ctx: ConfiguratorContext,
  ): boolean;
  create(
    input: CreateConfigurationInput,
    ctx: ConfiguratorContext,
  ): Promise<Configuration>;
  get(id: string, ctx: ConfiguratorContext): Promise<Configuration>;
  applyChanges(
    id: string,
    changes: ConfigurationChange[],
    ctx: ConfiguratorContext,
  ): Promise<Configuration>;
  renew(id: string, ctx: ConfiguratorContext): Promise<{ expiresAt: string }>;
  release(id: string, ctx: ConfiguratorContext): Promise<void>;
  commit(id: string, ctx: ConfiguratorContext): Promise<CommittedConfiguration>;
  /**
   * Adds a committed configuration to the cart and answers the line it landed
   * on, or none when the cart does not say. The cart itself is read back the
   * portal's ordinary way, so the caller keeps one cart shape.
   */
  addToCart(
    cartId: string,
    line: ConfiguredCartLine,
    ctx: ConfiguratorContext,
  ): Promise<{ itemId: string | null }>;
  /**
   * Opens a new session from a configured cart line, holding the choices it
   * was committed with. The line itself is not touched.
   */
  reopen(
    cartId: string,
    itemId: string,
    ctx: ConfiguratorContext,
  ): Promise<Configuration>;
  /**
   * Puts a committed configuration on an existing configured line, which keeps
   * its id, and its quantity unless one is given. A commit does not touch the
   * cart; this is the step that does.
   */
  replaceLine(
    cartId: string,
    itemId: string,
    committedConfigurationId: string,
    ctx: ConfiguratorContext,
    quantity?: number,
  ): Promise<{ itemId: string }>;
  /**
   * What each configured line of a cart was committed with, by item id. The
   * cart itself is the portal's ordinary read; this is merged into it.
   */
  cartLineConfigurations(
    cartId: string,
    ctx: ConfiguratorContext,
  ): Promise<Map<string, CartLineConfiguration>>;
  /**
   * Each row of an order by its position in the order's rows: its product's
   * type and what a configured row was committed with. The order itself is the
   * portal's ordinary read.
   */
  orderLineConfigurations(
    publicOrderId: string,
    ctx: ConfiguratorContext,
  ): Promise<Map<number, OrderLineRead>>;
  /**
   * The choices one order row was committed with, read only when a replay
   * starts; null when the row carries none.
   */
  orderLineChoices(
    publicOrderId: string,
    row: number,
    ctx: ConfiguratorContext,
  ): Promise<OrderLineChoices | null>;
}

/**
 * `composite` is dev's: the fixture for its seeds, merchant-api for every
 * other product. It goes when the fixture does.
 */
export type ConfiguratorBackendName =
  | 'off'
  | 'fixture'
  | 'merchant-api'
  | 'composite';

const IMPLEMENTED: readonly ConfiguratorBackendName[] = [
  'fixture',
  'merchant-api',
  'composite',
];

/**
 * Reads the runtime key strictly. A GitHub variable that does not exist arrives
 * as an empty string, and an empty `NUXT_*` value overrides the default in
 * nuxt.config.ts instead of falling back to it. So an environment that never
 * heard of this key has to reach `off` by the same path as one that set `off`
 * deliberately: only the implemented names are accepted, and every other
 * value — empty string and the retired `sdk` included — is `off`.
 */
export function resolveConfiguratorBackendName(
  value: unknown,
): ConfiguratorBackendName {
  return IMPLEMENTED.find((name) => name === value) ?? 'off';
}

export function buildConfiguratorContext(event: H3Event): ConfiguratorContext {
  const authToken = getSessionToken(event);
  return {
    hostname: event.context.tenant?.hostname ?? '',
    ...(authToken ? { userToken: authToken } : {}),
  };
}

/** The narrow context plus what the merchant-api backend sends. */
export async function buildConfiguratorRequestContext(
  event: H3Event,
): Promise<ConfiguratorContext> {
  const sdk = await getTenantSDK(event);
  return {
    ...buildConfiguratorContext(event),
    sdk: {
      configuration: sdk.oms.configuration,
      channel: getRequestChannelVariables(sdk, event),
    },
  };
}

/** Every method answers the same way, so the rejection is written once. */
function rejectingBackend(
  code: ErrorCode,
  reason: string,
): ConfiguratorBackend {
  const reject = async (): Promise<never> => {
    throw createAppError(code, reason);
  };
  return {
    isConfigurable: () => false,
    create: reject,
    get: reject,
    applyChanges: reject,
    renew: reject,
    release: reject,
    commit: reject,
    addToCart: reject,
    reopen: reject,
    replaceLine: reject,
    orderLineChoices: reject,
    // Asked of every cart and order, not of a request to configure: no lines,
    // no error.
    cartLineConfigurations: async () => new Map(),
    orderLineConfigurations: async () => new Map(),
  };
}

// Built per call rather than at module load: `ErrorCode` and `createAppError`
// are Nitro auto-imports, and a module-level call to them runs before a test
// can stub them.
const BACKENDS: Record<ConfiguratorBackendName, () => ConfiguratorBackend> = {
  off: () => rejectingBackend(ErrorCode.NOT_FOUND, 'The configurator is off'),
  fixture: () => fixtureConfiguratorBackend,
  'merchant-api': () => merchantApiConfiguratorBackend,
  composite: () =>
    createCompositeConfiguratorBackend(
      fixtureConfiguratorBackend,
      merchantApiConfiguratorBackend,
    ),
};

export function getConfiguratorBackend(event: H3Event): ConfiguratorBackend {
  return withoutRestatedRequirements(
    BACKENDS[
      resolveConfiguratorBackendName(readConfiguratorBackendValue(event))
    ](),
  );
}

/**
 * Whether a product is configured through the configurator. The product route
 * asks this to set the portal-side `configurable` flag, which is what decides
 * the page a product gets.
 *
 * It goes through the seam because the answer depends on the backend: the
 * fixture answers from its seeds, the rejecting backends answer no, and the
 * merchant-api backend reads the product's `type`.
 */
export function isConfigurableProduct(
  event: H3Event,
  product: ConfigurableCandidate,
): boolean {
  return configurableCheck(event)(product);
}

/**
 * `isConfigurableProduct` for a list: the backend and the context are resolved
 * once, and every product after that is an in-memory answer.
 */
export function configurableCheck(
  event: H3Event,
): (product: ConfigurableCandidate) => boolean {
  const backend = getConfiguratorBackend(event);
  const ctx = buildConfiguratorContext(event);
  return (product) => backend.isConfigurable(product, ctx);
}

/**
 * A product list as the cards need it: `type` goes to the seam and no further,
 * and `configurable` is spread only when true, as the product route does.
 */
export function withConfigurableFlags<
  T extends { productId?: number | string | null; type?: string | null },
>(
  event: H3Event,
  products: readonly (T | null)[],
): ((Omit<T, 'type'> & { configurable?: true }) | null)[] {
  const isConfigurable = configurableCheck(event);
  return products.map((product) => {
    if (!product) return product;
    const { type, ...rest } = product;
    return isConfigurable({ productId: String(rest.productId), type })
      ? { ...rest, configurable: true }
      : rest;
  });
}

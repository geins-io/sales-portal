import type { H3Event } from 'h3';
import type {
  CommittedConfiguration,
  Configuration,
  ConfigurationChange,
  CreateConfigurationInput,
} from '#shared/types/configurator';
import { getRequestChannelVariables, getTenantSDK } from './_sdk';
import { createCompositeConfiguratorBackend } from './configurator-composite';
import {
  readConfiguratorBackendValue,
  readConfiguratorMerchantApiUrl,
} from './configurator-config';
import { fixtureConfiguratorBackend } from './configurator-fixture';
import { merchantApiConfiguratorBackend } from './configurator-merchant-api';
import { withoutRestatedRequirements } from './configurator-messages';

// ---------------------------------------------------------------------------
// The seam between the portal and whatever produces a configuration.
//
// Routes and UI never learn which implementation answered. The Geins SDK does
// not carry the CPQ area: the real backend speaks GraphQL to merchant-api
// itself, and the SDK is used here only to read the request's channel.
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
  merchantApi?: MerchantApiTarget;
}

/** Where and as whom the merchant-api backend asks. */
export interface MerchantApiTarget {
  url: string;
  /** The account's own key from the tenant config; never logged. */
  apiKey: string;
  channelId: string;
  languageId: string;
  marketId: string;
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

/** The endpoint the SDK itself talks to, where the CPQ area ships eventually. */
export const MERCHANT_API_DEFAULT_URL = 'https://merchantapi.geins.io/graphql';

/**
 * The CPQ area is on its own host until it ships in the ordinary endpoint, so
 * an environment may point elsewhere. Empty for the same reason as above.
 */
export function resolveMerchantApiUrl(value: unknown): string {
  return typeof value === 'string' && value !== ''
    ? value
    : MERCHANT_API_DEFAULT_URL;
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
    merchantApi: {
      url: resolveMerchantApiUrl(readConfiguratorMerchantApiUrl(event)),
      apiKey: event.context.tenant?.config?.geinsSettings?.apiKey ?? '',
      ...getRequestChannelVariables(sdk, event),
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
  return getConfiguratorBackend(event).isConfigurable(
    product,
    buildConfiguratorContext(event),
  );
}

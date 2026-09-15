import type { H3Event } from 'h3';
import type {
  CommittedConfiguration,
  Configuration,
  ConfigurationChange,
  CreateConfigurationInput,
} from '#shared/types/configurator';
import { readConfiguratorBackendValue } from './configurator-config';
import { fixtureConfiguratorBackend } from './configurator-fixture';

// ---------------------------------------------------------------------------
// The seam between the portal and whatever produces a configuration.
//
// Routes and UI never learn which implementation answered. M4 adds the SDK
// implementation here and nothing above this file changes. No Geins SDK
// import belongs in this module or in the fixture folder.
// ---------------------------------------------------------------------------

/**
 * What a backend needs from the request. It plays the role the `H3Event` plays
 * in the other services, so no implementation below the seam reaches into the
 * event itself.
 */
export interface ConfiguratorContext {
  hostname: string;
  userToken?: string;
}

export interface ConfiguratorBackend {
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

export type ConfiguratorBackendName = 'off' | 'fixture' | 'sdk';

/**
 * Reads the runtime key strictly. A GitHub variable that does not exist arrives
 * as an empty string, and an empty `NUXT_*` value overrides the default in
 * nuxt.config.ts instead of falling back to it. So an environment that never
 * heard of this key has to reach `off` by the same path as one that set `off`
 * deliberately: only the two implemented names are accepted, and every other
 * value — empty string included — is `off`.
 */
export function resolveConfiguratorBackendName(
  value: unknown,
): ConfiguratorBackendName {
  return value === 'fixture' || value === 'sdk' ? value : 'off';
}

export function buildConfiguratorContext(event: H3Event): ConfiguratorContext {
  const { authToken } = getAuthCookies(event);
  return {
    hostname: event.context.tenant?.hostname ?? '',
    ...(authToken ? { userToken: authToken } : {}),
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
  sdk: () =>
    rejectingBackend(
      ErrorCode.NOT_IMPLEMENTED,
      'The configurator SDK backend lands with the SDK support',
    ),
};

export function getConfiguratorBackend(event: H3Event): ConfiguratorBackend {
  return BACKENDS[
    resolveConfiguratorBackendName(readConfiguratorBackendValue(event))
  ]();
}

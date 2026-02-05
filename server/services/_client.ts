import { GeinsCore } from '@geins/core';
import { GeinsCRM } from '@geins/crm';
import { GeinsCMS } from '@geins/cms';
import { GeinsOMS } from '@geins/oms';
import { RuntimeContext } from '@geins/types';
import type { GeinsSettings as SdkGeinsSettings } from '@geins/types';
import type { H3Event } from 'h3';
import type { GeinsSettings as TenantGeinsSettings } from '#shared/types/tenant-config';

export interface GeinsClient {
  core: GeinsCore;
  crm: GeinsCRM;
  cms: GeinsCMS;
  oms: GeinsOMS;
}

/**
 * Maps our tenant environment values to SDK environment values.
 * Our config uses 'production'/'staging', SDK expects 'prod'/'qa'/'dev'.
 */
function mapEnvironment(
  env?: TenantGeinsSettings['environment'],
): SdkGeinsSettings['environment'] {
  switch (env) {
    case 'staging':
      return 'qa';
    case 'production':
    default:
      return 'prod';
  }
}

/** Per-tenant singleton cache. Same tenant reuses the same SDK client. */
const clientCache = new Map<string, GeinsClient>();

/**
 * Creates a Geins SDK client from tenant Geins settings.
 */
export function createGeinsClient(
  geinsSettings: TenantGeinsSettings,
): GeinsClient {
  const sdkSettings: SdkGeinsSettings = {
    apiKey: geinsSettings.apiKey,
    accountName: geinsSettings.accountName,
    channel: geinsSettings.channel,
    tld: geinsSettings.tld,
    locale: geinsSettings.locale,
    market: geinsSettings.market,
    environment: mapEnvironment(geinsSettings.environment),
  };

  const core = new GeinsCore(sdkSettings);
  const crm = new GeinsCRM(core, { clientConnectionMode: 'Direct' });
  const cms = new GeinsCMS(core);
  const oms = new GeinsOMS(core, {
    omsSettings: { context: RuntimeContext.SERVER },
  });

  return { core, crm, cms, oms };
}

/**
 * Extracts channel context variables from a GeinsClient for raw GraphQL queries.
 * All Geins GraphQL queries accept optional channelId, languageId, marketId.
 */
export function getChannelVariables(client: GeinsClient): {
  channelId: string;
  languageId: string;
  marketId: string;
} {
  const settings = client.core.geinsSettings;
  return {
    channelId: settings.channel,
    languageId: settings.locale,
    marketId: settings.market,
  };
}

/**
 * Returns a per-tenant singleton Geins SDK client.
 * Same tenant reuses the same instance across requests — the hardened SDK
 * (NO_CACHE fetch policy, per-operation tokens) makes this safe.
 * Different tenants get different instances (isolated by hostname).
 */
export async function getGeinsClient(event: H3Event): Promise<GeinsClient> {
  const hostname = event.context.tenant?.hostname;
  if (!hostname) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'No tenant context on request');
  }

  const cached = clientCache.get(hostname);
  if (cached) {
    return cached;
  }

  const tenant = await getTenant(hostname, event);
  if (!tenant?.geinsSettings) {
    throw createAppError(
      ErrorCode.BAD_REQUEST,
      'Tenant has no Geins SDK configuration',
    );
  }

  const client = createGeinsClient(tenant.geinsSettings);
  clientCache.set(hostname, client);
  return client;
}

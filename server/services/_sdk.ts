import { GeinsCore } from '@geins/core';
import { GeinsCRM } from '@geins/crm';
import { GeinsCMS } from '@geins/cms';
import { GeinsOMS } from '@geins/oms';
import { RuntimeContext } from '@geins/types';
import type { GeinsSettings as SdkGeinsSettings } from '@geins/types';
import type { H3Event } from 'h3';
import type { GeinsSettings as TenantGeinsSettings } from '#shared/types/tenant-config';

export interface TenantSDK {
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

/** Per-tenant singleton cache. Same tenant reuses the same SDK instance. */
const tenants = new Map<string, TenantSDK>();

/**
 * Creates a Geins SDK instance from tenant Geins settings.
 */
export function createTenantSDK(geinsSettings: TenantGeinsSettings): TenantSDK {
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
 * Extracts channel context variables from a TenantSDK for raw GraphQL queries.
 * All Geins GraphQL queries accept optional channelId, languageId, marketId.
 */
export function getChannelVariables(sdk: TenantSDK): {
  channelId: string;
  languageId: string;
  marketId: string;
} {
  const settings = sdk.core.geinsSettings;
  return {
    channelId: settings.channel,
    languageId: settings.locale,
    marketId: settings.market,
  };
}

/**
 * Returns a per-tenant singleton Geins SDK instance.
 * Same tenant reuses the same instance across requests — the stateless SDK
 * (NO_CACHE fetch policy, per-operation tokens) makes this safe.
 * Different tenants get different instances (isolated by hostname).
 */
export async function getTenantSDK(event: H3Event): Promise<TenantSDK> {
  const hostname = event.context.tenant?.hostname;
  if (!hostname) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'No tenant context on request');
  }

  const cached = tenants.get(hostname);
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

  const sdk = createTenantSDK(tenant.geinsSettings);
  tenants.set(hostname, sdk);
  return sdk;
}

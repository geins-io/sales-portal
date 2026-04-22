import type { TenantConfig } from '#shared/types/tenant-config';
import type { ResolvedLocaleMarket } from '#shared/utils/locale-market';

declare module 'h3' {
  interface H3EventContext {
    tenant: {
      /** The tenant client hostname. */
      hostname: string;
      /** The resolved tenant ID (may differ from hostname for multi-hostname tenants). */
      tenantId?: string;
      /** Full resolved tenant config (set by 02.tenant-context plugin). */
      config?: TenantConfig;
    };
    /** Raw market/locale parsed from URL prefix by plugin 00. */
    localeMarket: { market: string; locale: string } | undefined;
    /** Validated locale/market with BCP-47 expansion, set by plugin 01. */
    resolvedLocaleMarket: ResolvedLocaleMarket | undefined;
  }
}

export {};

declare module 'h3' {
  interface H3EventContext {
    tenant: {
      /** The tenant client hostname. */
      hostname: string;
      /** The resolved tenant ID (may differ from hostname for multi-hostname tenants). */
      tenantId?: string;
    };
  }
}

export {};

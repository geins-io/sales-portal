declare module 'h3' {
  interface H3EventContext {
    tenant: {
      /** The tenant client hostname. */
      hostname: string;
    };
  }
}

export {};

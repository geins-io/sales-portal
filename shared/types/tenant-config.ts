export type TenantConfig = {
  tenantId: string;
  hostname: string;
  geinsSettings?: {
    apiKey: string;
    accountName: string;
    channel: string;
    tld: string;
    locale: string;
    market: string;
  };
  theme: {
    name: string;
    colors: {
      primary: string;
      secondary: string;
    };
  };
  css: string;
};

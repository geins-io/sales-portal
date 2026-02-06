import type { GeinsSettings } from '#shared/types/tenant-config';
import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

export const geinsSettings: GeinsSettings = {
  apiKey: process.env.GEINS_API_KEY!,
  accountName: process.env.GEINS_ACCOUNT_NAME!,
  channel: process.env.GEINS_CHANNEL!,
  tld: process.env.GEINS_TLD!,
  locale: process.env.GEINS_LOCALE!,
  market: process.env.GEINS_MARKET!,
  environment:
    (process.env.GEINS_ENVIRONMENT as 'production' | 'staging') || undefined,
};

export const userCredentials = {
  username: process.env.GEINS_USERNAME || '',
  password: process.env.GEINS_PASSWORD || '',
  rememberUser: true,
};

export const cmsSettings = {
  area: {
    family: process.env.GEINS_CMS_FAMILY || '',
    areaName: process.env.GEINS_CMS_AREA || '',
  },
  page: {
    alias: process.env.GEINS_CMS_PAGE_ALIAS || '',
  },
};

export const omsSettings = {
  skus: {
    skuId1: parseInt(process.env.GEINS_OMS_SKUID1 || '0', 10),
    skuId2: parseInt(process.env.GEINS_OMS_SKUID2 || '0', 10),
    skuId3: parseInt(process.env.GEINS_OMS_SKUID3 || '0', 10),
  },
  promoCode: process.env.GEINS_PROMO_CODE || '',
};

/**
 * Returns true if Geins API credentials are configured.
 * Integration tests should skip when credentials are not available.
 */
export function hasGeinsCredentials(): boolean {
  return !!(
    process.env.GEINS_API_KEY &&
    process.env.GEINS_ACCOUNT_NAME &&
    process.env.GEINS_CHANNEL
  );
}

/** Returns true if CRM test user credentials are configured. */
export function hasCrmCredentials(): boolean {
  return !!(process.env.GEINS_USERNAME && process.env.GEINS_PASSWORD);
}

/** Returns true if CMS test content identifiers are configured. */
export function hasCmsContent(): boolean {
  return !!(process.env.GEINS_CMS_FAMILY && process.env.GEINS_CMS_AREA);
}

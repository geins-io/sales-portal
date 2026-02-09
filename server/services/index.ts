// SDK-backed services (CRM, CMS, OMS)
export * as auth from './auth';
export * as user from './user';
export * as cms from './cms';
export * as cart from './cart';
export * as checkout from './checkout';
export * as orders from './orders';

// Direct GraphQL services (no SDK package yet)
export * as products from './products';
export * as productLists from './product-lists';
export * as brands from './brands';
export * as categories from './categories';
export * as search from './search';
export * as channels from './channels';
export * as newsletter from './newsletter';

// SDK factory
export { getTenantSDK, createTenantSDK, getChannelVariables } from './_sdk';

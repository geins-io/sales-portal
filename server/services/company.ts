import type { H3Event } from 'h3';
import type {
  Company,
  CompanyAddress,
  CompanyBuyer,
} from '#shared/types/company';
import {
  getTenantSDK,
  getRequestChannelVariables,
  buildRequestContext,
} from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';

// ---------------------------------------------------------------------------
// GraphQL response shapes (raw Geins API)
// ---------------------------------------------------------------------------

interface RawCompanyAddress {
  addressId: string;
  companyId?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  careOf?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressLine3?: string | null;
  zip?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  addressType?: string | null;
  addressReferenceId?: string | null;
}

interface RawCompanyBuyer {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  companyId?: string | null;
  active: boolean;
  restrictToDedicatedPriceLists: boolean;
}

interface RawCompany {
  id: string;
  name?: string | null;
  vatNumber?: string | null;
  exVat: boolean;
  limitedProductAccess: boolean;
  addresses?: RawCompanyAddress[] | null;
  buyers?: RawCompanyBuyer[] | null;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function mapAddress(raw: RawCompanyAddress): CompanyAddress {
  return {
    addressId: raw.addressId,
    companyId: raw.companyId ?? null,
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    company: raw.company ?? null,
    firstName: raw.firstName ?? null,
    lastName: raw.lastName ?? null,
    careOf: raw.careOf ?? null,
    addressLine1: raw.addressLine1 ?? null,
    addressLine2: raw.addressLine2 ?? null,
    addressLine3: raw.addressLine3 ?? null,
    zip: raw.zip ?? null,
    city: raw.city ?? null,
    region: raw.region ?? null,
    country: raw.country ?? null,
    addressType: raw.addressType ?? null,
    addressReferenceId: raw.addressReferenceId ?? null,
  };
}

function mapBuyer(raw: RawCompanyBuyer): CompanyBuyer {
  return {
    id: raw.id,
    firstName: raw.firstName ?? null,
    lastName: raw.lastName ?? null,
    phone: raw.phone ?? null,
    companyId: raw.companyId ?? null,
    active: raw.active,
    restrictToDedicatedPriceLists: raw.restrictToDedicatedPriceLists,
  };
}

function mapCompany(raw: RawCompany): Company {
  return {
    id: raw.id,
    name: raw.name ?? null,
    vatNumber: raw.vatNumber ?? null,
    exVat: raw.exVat,
    limitedProductAccess: raw.limitedProductAccess,
    addresses: raw.addresses ? raw.addresses.map(mapAddress) : null,
    buyers: raw.buyers ? raw.buyers.map(mapBuyer) : null,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

// Returns null when Geins signals "User not found" (data.getCompany: null). Other errors propagate.
export async function getCompany(event: H3Event): Promise<Company | null> {
  const requestContext = buildRequestContext(event);

  const sdk = await getTenantSDK(event);
  const { channelId, languageId, marketId } = getRequestChannelVariables(
    sdk,
    event,
  );

  const raw = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('company/get-company.graphql'),
        variables: { channelId, languageId, marketId },
        userToken: requestContext?.userToken,
      }),
    'company',
  );

  // unwrapGraphQL strips the { getCompany: ... } wrapper, returning the inner value or null.
  const result = unwrapGraphQL(raw) as RawCompany | null;

  if (!result) {
    return null;
  }

  return mapCompany(result);
}

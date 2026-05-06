// ---------------------------------------------------------------------------
// Company types mirroring the Geins getCompany GraphQL schema
// verified against merchantapi.geins.io on 2026-05-06.
// Do NOT import these from @geins/types — the SDK does not yet ship them.
// ---------------------------------------------------------------------------

export interface CompanyAddress {
  /** Non-nullable per schema */
  addressId: string;
  companyId: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  firstName: string | null;
  lastName: string | null;
  careOf: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressLine3: string | null;
  zip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  addressType: string | null;
  addressReferenceId: string | null;
}

export interface CompanyBuyer {
  /** Non-nullable per schema */
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  companyId: string | null;
  /** Non-nullable per schema */
  active: boolean;
  /** Non-nullable per schema */
  restrictToDedicatedPriceLists: boolean;
}

export interface Company {
  /** Non-nullable per schema */
  id: string;
  name: string | null;
  vatNumber: string | null;
  /** Non-nullable per schema */
  exVat: boolean;
  /** Non-nullable per schema */
  limitedProductAccess: boolean;
  addresses: CompanyAddress[] | null;
  buyers: CompanyBuyer[] | null;
}

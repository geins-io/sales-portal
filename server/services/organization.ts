import type { H3Event } from 'h3';
import type {
  Organization,
  OrgAddress,
  Buyer,
  BuyerRole,
  ShippingAddress,
} from '#shared/types/b2b';
import {
  getOrganizationStub,
  updateOrganizationStub,
  getAddressesStub,
  addAddressStub,
  updateAddressStub,
  removeAddressStub,
  getBuyersStub,
  inviteBuyerStub,
  updateBuyerRoleStub,
  deactivateBuyerStub,
  reactivateBuyerStub,
  getOrganizationByUserStub,
  getBuyerByUserStub,
} from './stubs/organization';

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

/** TODO: Replace stub with Geins API — GET /organizations/{id} */
export async function getOrganization(
  orgId: string,
  _event: H3Event,
): Promise<Organization> {
  return getOrganizationStub(orgId);
}

/** TODO: Replace stub with Geins API — PATCH /organizations/{id} */
export async function updateOrganization(
  orgId: string,
  data: Partial<
    Pick<Organization, 'name' | 'referenceContact' | 'email' | 'phone'>
  >,
  _event: H3Event,
): Promise<Organization> {
  return updateOrganizationStub(orgId, data);
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

/** TODO: Replace stub with Geins API — GET /organizations/{id}/addresses */
export async function getAddresses(
  orgId: string,
  _event: H3Event,
): Promise<OrgAddress[]> {
  return getAddressesStub(orgId);
}

/** TODO: Replace stub with Geins API — POST /organizations/{id}/addresses */
export async function addAddress(
  orgId: string,
  label: string,
  address: ShippingAddress,
  isDefault: boolean | undefined,
  _event: H3Event,
): Promise<OrgAddress> {
  return addAddressStub(orgId, label, address, isDefault);
}

/** TODO: Replace stub with Geins API — PATCH /organizations/{id}/addresses/{addressId} */
export async function updateAddress(
  orgId: string,
  addressId: string,
  data: Partial<Pick<OrgAddress, 'label' | 'isDefault' | 'address'>>,
  _event: H3Event,
): Promise<OrgAddress> {
  return updateAddressStub(orgId, addressId, data);
}

/** TODO: Replace stub with Geins API — DELETE /organizations/{id}/addresses/{addressId} */
export async function removeAddress(
  orgId: string,
  addressId: string,
  _event: H3Event,
): Promise<void> {
  removeAddressStub(orgId, addressId);
}

// ---------------------------------------------------------------------------
// Buyers
// ---------------------------------------------------------------------------

/** TODO: Replace stub with Geins API — GET /organizations/{id}/buyers */
export async function getBuyers(
  orgId: string,
  _event: H3Event,
): Promise<Buyer[]> {
  return getBuyersStub(orgId);
}

/** TODO: Replace stub with Geins API — POST /organizations/{id}/buyers/invite */
export async function inviteBuyer(
  orgId: string,
  email: string,
  firstName: string,
  lastName: string,
  role: BuyerRole,
  _event: H3Event,
): Promise<Buyer> {
  return inviteBuyerStub(orgId, email, firstName, lastName, role);
}

/** TODO: Replace stub with Geins API — PATCH /organizations/{id}/buyers/{buyerId}/role */
export async function updateBuyerRole(
  orgId: string,
  buyerId: string,
  role: BuyerRole,
  _event: H3Event,
): Promise<Buyer> {
  return updateBuyerRoleStub(orgId, buyerId, role);
}

/** TODO: Replace stub with Geins API — POST /organizations/{id}/buyers/{buyerId}/deactivate */
export async function deactivateBuyer(
  orgId: string,
  buyerId: string,
  _event: H3Event,
): Promise<Buyer> {
  return deactivateBuyerStub(orgId, buyerId);
}

/** TODO: Replace stub with Geins API — POST /organizations/{id}/buyers/{buyerId}/reactivate */
export async function reactivateBuyer(
  orgId: string,
  buyerId: string,
  _event: H3Event,
): Promise<Buyer> {
  return reactivateBuyerStub(orgId, buyerId);
}

// ---------------------------------------------------------------------------
// "My" endpoints — resolve by authenticated userId
// ---------------------------------------------------------------------------

/** TODO: Replace stub with Geins API — GET /me/organization */
export async function getMyOrganization(
  userId: string,
  _event: H3Event,
): Promise<Organization> {
  return getOrganizationByUserStub(userId);
}

/** TODO: Replace stub with Geins API — GET /me/buyer-profile */
export async function getMyBuyerProfile(
  userId: string,
  _event: H3Event,
): Promise<Buyer> {
  return getBuyerByUserStub(userId);
}

import * as organizationService from '../../../services/organization';
import { requirePermission } from '../../../utils/b2b-auth';

export default defineEventHandler(async (event) => {
  const { buyer } = await requirePermission(event, 'org:manage_addresses');
  const addressId = getRouterParam(event, 'id');

  if (!addressId) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'Address ID is required');
  }

  await organizationService.removeAddress(
    buyer.organizationId,
    addressId,
    event,
  );

  return { success: true };
});

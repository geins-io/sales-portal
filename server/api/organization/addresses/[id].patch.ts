import type { OrgAddress } from '#shared/types/b2b';
import * as organizationService from '../../../services/organization';
import { requirePermission } from '../../../utils/b2b-auth';
import { UpdateAddressSchema } from '../../../schemas/api-input';

export default defineEventHandler(async (event) => {
  const { buyer } = await requirePermission(event, 'org:manage_addresses');
  const addressId = getRouterParam(event, 'id');

  if (!addressId) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'Address ID is required');
  }

  const body = await readValidatedBody(event, UpdateAddressSchema.parse);

  const address = await organizationService.updateAddress(
    buyer.organizationId,
    addressId,
    body as Partial<Pick<OrgAddress, 'label' | 'isDefault' | 'address'>>,
    event,
  );

  return { address };
});

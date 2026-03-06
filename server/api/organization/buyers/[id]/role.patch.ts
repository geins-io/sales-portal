import * as organizationService from '../../../../services/organization';
import { requirePermission } from '../../../../utils/b2b-auth';
import { UpdateBuyerRoleSchema } from '../../../../schemas/api-input';

export default defineEventHandler(async (event) => {
  const { buyer } = await requirePermission(event, 'org:manage_roles');
  const buyerId = getRouterParam(event, 'id');

  if (!buyerId) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'Buyer ID is required');
  }

  const body = await readValidatedBody(event, UpdateBuyerRoleSchema.parse);

  const updated = await organizationService.updateBuyerRole(
    buyer.organizationId,
    buyerId,
    body.role,
    event,
  );

  return { buyer: updated };
});

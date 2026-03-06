import * as organizationService from '../../../../services/organization';
import { requirePermission } from '../../../../utils/b2b-auth';

export default defineEventHandler(async (event) => {
  const { buyer } = await requirePermission(event, 'org:manage_buyers');
  const buyerId = getRouterParam(event, 'id');

  if (!buyerId) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'Buyer ID is required');
  }

  const updated = await organizationService.reactivateBuyer(
    buyer.organizationId,
    buyerId,
    event,
  );

  return { buyer: updated };
});

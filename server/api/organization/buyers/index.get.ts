import * as organizationService from '../../../services/organization';
import { requirePermission } from '../../../utils/b2b-auth';

export default defineEventHandler(async (event) => {
  const { buyer } = await requirePermission(event, 'org:view');
  const buyers = await organizationService.getBuyers(
    buyer.organizationId,
    event,
  );

  return { buyers };
});

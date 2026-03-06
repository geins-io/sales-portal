import * as organizationService from '../../../services/organization';
import { requirePermission } from '../../../utils/b2b-auth';

export default defineEventHandler(async (event) => {
  const { buyer } = await requirePermission(event, 'org:view');
  const addresses = await organizationService.getAddresses(
    buyer.organizationId,
    event,
  );

  return { addresses };
});

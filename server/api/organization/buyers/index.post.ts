import * as organizationService from '../../../services/organization';
import { requirePermission } from '../../../utils/b2b-auth';
import { InviteBuyerSchema } from '../../../schemas/api-input';

export default defineEventHandler(async (event) => {
  const { buyer } = await requirePermission(event, 'org:manage_buyers');
  const body = await readValidatedBody(event, InviteBuyerSchema.parse);

  const invited = await organizationService.inviteBuyer(
    buyer.organizationId,
    body.email,
    body.firstName,
    body.lastName,
    body.role,
    event,
  );

  return { buyer: invited };
});

import * as organizationService from '../../services/organization';
import { requirePermission } from '../../utils/b2b-auth';
import { UpdateOrganizationSchema } from '../../schemas/api-input';

export default defineEventHandler(async (event) => {
  const { buyer } = await requirePermission(event, 'org:edit');
  const body = await readValidatedBody(event, UpdateOrganizationSchema.parse);

  const organization = await organizationService.updateOrganization(
    buyer.organizationId,
    body,
    event,
  );

  return { organization };
});

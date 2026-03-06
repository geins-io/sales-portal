import * as organizationService from '../../services/organization';
import { requireOrgMembership } from '../../utils/b2b-auth';

export default defineEventHandler(async (event) => {
  const { buyer } = await requireOrgMembership(event);
  const organization = await organizationService.getOrganization(
    buyer.organizationId,
    event,
  );

  return { organization };
});

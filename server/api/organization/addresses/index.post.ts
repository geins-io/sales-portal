import * as organizationService from '../../../services/organization';
import { requirePermission } from '../../../utils/b2b-auth';
import { AddAddressSchema } from '../../../schemas/api-input';

export default defineEventHandler(async (event) => {
  const { buyer } = await requirePermission(event, 'org:manage_addresses');
  const body = await readValidatedBody(event, AddAddressSchema.parse);

  const address = await organizationService.addAddress(
    buyer.organizationId,
    body.label,
    body.address,
    body.isDefault,
    event,
  );

  return { address };
});

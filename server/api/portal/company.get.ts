import * as companyService from '../../services/company';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  setResponseHeader(event, 'Cache-Control', 'private, no-cache');

  const company = await companyService.getCompany(event);

  if (!company) {
    throw createAppError(ErrorCode.NOT_FOUND, 'COMPANY_NOT_FOUND');
  }

  return { company };
});

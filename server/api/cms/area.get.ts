import { CmsAreaSchema } from '../../schemas/api-input';
import { getContentArea } from '../../services/cms';
import { sanitizeCmsArea } from '../../utils/cms-sanitize';

export default defineEventHandler(async (event) => {
  const { family, areaName } = await getValidatedQuery(
    event,
    CmsAreaSchema.parse,
  );
  const customerType = await getCustomerType(event);

  if (customerType) {
    setHeader(event, 'Cache-Control', 'private, no-store');
  } else {
    setHeader(event, 'Cache-Control', 'private, no-cache');
  }

  return withErrorHandling(
    async () => {
      const area = await getContentArea(
        { family, areaName, customerType },
        event,
      );

      if (!area?.containers?.length) {
        throw createAppError(ErrorCode.NOT_FOUND, 'Content area not found');
      }

      return sanitizeCmsArea(area);
    },
    { operation: 'cms.area.get' },
  );
});

import { CmsAreaSchema } from '../../schemas/api-input';
import { getContentArea } from '../../services/cms';
import { sanitizeCmsArea } from '../../utils/cms-sanitize';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const { family, areaName } = CmsAreaSchema.parse(query);

  return withErrorHandling(
    async () => {
      const area = await getContentArea({ family, areaName }, event);

      if (!area?.containers?.length) {
        throw createAppError(ErrorCode.NOT_FOUND, 'Content area not found');
      }

      return sanitizeCmsArea(area);
    },
    { operation: 'cms.area.get' },
  );
});

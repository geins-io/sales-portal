import { CmsAreaSchema } from '../../schemas/api-input';
import { getContentArea } from '../../services/cms';
import { sanitizeCmsArea } from '../../utils/cms-sanitize';
import { logger } from '../../utils/logger';

export default defineEventHandler(async (event) => {
  const { family, areaName, displaySetting } = await getValidatedQuery(
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
        { family, areaName, customerType, displaySetting },
        event,
      );

      if (!area?.containers?.length) {
        // A missing CMS content area is typically a Studio configuration gap,
        // not a bug in our code. Log at info level so it does not trip error
        // alerts, and return a specific code so optional consumers (e.g. the
        // Portal page Hero banner) can swallow it silently while required
        // consumers can still surface a 404.
        logger.info('Content area not found', {
          family,
          areaName,
          code: 'CMS_AREA_NOT_FOUND',
        });
        throw createError({
          statusCode: 404,
          statusMessage: 'Content area not found',
          message: 'Content area not found',
          data: { code: 'CMS_AREA_NOT_FOUND' },
        });
      }

      return sanitizeCmsArea(area);
    },
    { operation: 'cms.area.get' },
  );
});

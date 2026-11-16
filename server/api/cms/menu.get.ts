import { CmsMenuSchema } from '../../schemas/api-input';
import { getMenu } from '../../services/cms';
import { hasCmsUserToken } from '../../utils/request-identity';

export default defineEventHandler(async (event) => {
  const { menuLocationId } = await getValidatedQuery(
    event,
    CmsMenuSchema.parse,
  );

  setHeader(
    event,
    'Cache-Control',
    hasCmsUserToken(event) ? 'private, no-store' : 'private, no-cache',
  );

  return withErrorHandling(
    async () => {
      const result = await getMenu({ menuLocationId }, event);

      return result;
    },
    { operation: 'cms.menu.get' },
  );
});

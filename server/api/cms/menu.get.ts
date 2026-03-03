import { CmsMenuSchema } from '../../schemas/api-input';
import { getMenu } from '../../services/cms';

export default defineEventHandler(async (event) => {
  const { menuLocationId } = await getValidatedQuery(
    event,
    CmsMenuSchema.parse,
  );

  return withErrorHandling(
    async () => {
      return await getMenu({ menuLocationId }, event);
    },
    { operation: 'cms.menu.get' },
  );
});

import { CmsMenuSchema } from '../../schemas/api-input';
import { getMenu } from '../../services/cms';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const { menuLocationId } = CmsMenuSchema.parse(query);

  return withErrorHandling(
    async () => {
      return await getMenu({ menuLocationId }, event);
    },
    { operation: 'cms.menu.get' },
  );
});

import { CmsMenuSchema } from '../../schemas/api-input';
import { getMenu } from '../../services/cms';

export default defineEventHandler(async (event) => {
  const { menuLocationId } = await getValidatedQuery(
    event,
    CmsMenuSchema.parse,
  );

  return withErrorHandling(
    async () => {
      const result = await getMenu({ menuLocationId }, event);

      setHeader(
        event,
        'Cache-Control',
        'public, s-maxage=300, stale-while-revalidate=600',
      );

      return result;
    },
    { operation: 'cms.menu.get' },
  );
});

import { CmsPageLinkSchema } from '../../schemas/api-input';
import { getPageLinkByTag } from '../../services/cms';

export default defineEventHandler(async (event) => {
  const { tag } = await getValidatedQuery(event, CmsPageLinkSchema.parse);

  return withErrorHandling(
    async () => {
      const url = await getPageLinkByTag({ tag }, event);
      setHeader(event, 'Cache-Control', 'private, no-cache');
      return { url };
    },
    { operation: 'cms.page-link.get' },
  );
});

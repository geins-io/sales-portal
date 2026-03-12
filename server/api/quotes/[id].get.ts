import * as quotesService from '../../services/quotes';
import { requirePermission } from '../../utils/b2b-auth';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'quotes:view_own');

  const id = getRouterParam(event, 'id');

  const quote = await quotesService.getQuote(id as string, event);

  return { quote };
});

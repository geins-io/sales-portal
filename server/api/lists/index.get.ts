import * as savedListsService from '../../services/saved-lists';
import * as authService from '../../services/auth';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const tokens = await requireAuth(event);

  const authResult = await authService.getUser(
    tokens.refreshToken,
    tokens.authToken,
    event,
  );

  if (!authResult?.succeeded || !authResult.user?.userId) {
    throw createAppError(
      ErrorCode.BAD_REQUEST,
      'Unable to resolve user identity',
    );
  }

  return withErrorHandling(
    async () => {
      const lists = await savedListsService.getLists(
        authResult.user!.userId!,
        event,
      );
      return { lists, total: lists.length };
    },
    { operation: 'lists.list' },
  );
});

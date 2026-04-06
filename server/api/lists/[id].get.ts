import * as savedListsService from '../../services/saved-lists';
import * as authService from '../../services/auth';
import { requireAuth } from '../../utils/auth';
import { SavedListIdSchema } from '../../schemas/api-input';

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

  const id = getRouterParam(event, 'id');
  const { id: validatedId } = SavedListIdSchema.parse({ id });

  setResponseHeader(event, 'Cache-Control', 'private, no-cache');
  return withErrorHandling(
    async () => {
      const list = await savedListsService.getList(
        validatedId,
        authResult.user!.userId!,
        event,
      );
      return { list };
    },
    { operation: 'lists.get' },
  );
});

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

  return withErrorHandling(
    async () => {
      await savedListsService.deleteList(
        validatedId,
        authResult.user!.userId!,
        event,
      );
      setResponseStatus(event, 204);
      return null;
    },
    { operation: 'lists.delete' },
  );
});

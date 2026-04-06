import * as savedListsService from '../../services/saved-lists';
import * as authService from '../../services/auth';
import { requireAuth } from '../../utils/auth';
import { CreateSavedListSchema } from '../../schemas/api-input';

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

  const body = await readValidatedBody(event, (raw) =>
    CreateSavedListSchema.parse(raw),
  );

  return withErrorHandling(
    async () => {
      const list = await savedListsService.createList(
        authResult.user!.userId!,
        body,
        event,
      );
      setResponseStatus(event, 201);
      return { list };
    },
    { operation: 'lists.create' },
  );
});

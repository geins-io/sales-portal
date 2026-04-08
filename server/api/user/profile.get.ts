import * as userService from '../../services/user';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const { authToken } = await requireAuth(event);
  setResponseHeader(event, 'Cache-Control', 'private, no-cache');
  const profile = await userService.getUser(authToken, event);

  if (!profile) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'User profile not found');
  }

  return { profile };
});

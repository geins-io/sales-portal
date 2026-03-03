import * as userService from '../../services/user';
import { requireAuth } from '../../utils/auth';
import { UpdateProfileSchema } from '../../schemas/api-input';

export default defineEventHandler(async (event) => {
  const { authToken } = await requireAuth(event);
  const body = await readValidatedBody(event, UpdateProfileSchema.parse);

  const profile = await userService.updateUser(body, authToken, event);

  if (!profile) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'Failed to update profile');
  }

  return { profile };
});

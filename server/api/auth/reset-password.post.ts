import * as userService from '../../services/user';
import { ResetPasswordSchema } from '../../schemas/api-input';

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, ResetPasswordSchema.parse);

  const result = await userService.commitPasswordReset(
    body.resetKey,
    body.password,
    event,
  );

  if (!result) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'Password reset failed');
  }

  return { success: true };
});

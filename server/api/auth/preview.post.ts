import { PreviewSchema } from '../../schemas/api-input';

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, PreviewSchema.parse);

  clearAuthCookies(event);
  setPreviewAuthToken(event, body.loginToken);
  setPreviewCookie(event);

  return { success: true };
});

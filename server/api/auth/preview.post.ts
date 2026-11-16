import { PreviewSchema } from '../../schemas/api-input';

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, PreviewSchema.parse);

  setPreviewToken(event, body.loginToken);
  setPreviewCookie(event);

  return { success: true };
});

export default defineEventHandler(async (event) => {
  const body = await readBody<{ loginToken: string }>(event);

  if (!body?.loginToken || typeof body.loginToken !== 'string') {
    throw createAppError(ErrorCode.VALIDATION_ERROR, 'loginToken is required');
  }

  clearAuthCookies(event);
  setPreviewAuthToken(event, body.loginToken);
  setPreviewCookie(event);

  return { success: true };
});

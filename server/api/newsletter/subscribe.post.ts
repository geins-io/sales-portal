import * as newsletterService from '../../services/newsletter';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email: string }>(event);

  if (!body?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    throw createAppError(
      ErrorCode.VALIDATION_ERROR,
      'A valid email address is required',
    );
  }

  await newsletterService.subscribe({ email: body.email }, event);

  return { ok: true };
});

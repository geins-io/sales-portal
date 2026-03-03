import * as newsletterService from '../../services/newsletter';
import { NewsletterSubscribeSchema } from '../../schemas/api-input';

export default defineEventHandler(async (event) => {
  const ip = getClientIp(event);
  const { allowed } = await newsletterRateLimiter.check(ip);
  if (!allowed) {
    throw createAppError(ErrorCode.RATE_LIMITED, 'Too many attempts');
  }

  const body = await readValidatedBody(event, NewsletterSubscribeSchema.parse);

  await newsletterService.subscribe({ email: body.email }, event);

  return { ok: true };
});

import { ContactFormSchema } from '../../schemas/api-input';

export default defineEventHandler(async (event) => {
  const ip = getClientIp(event);
  const { allowed } = await contactFormRateLimiter.check(ip);
  if (!allowed) {
    throw createAppError(
      ErrorCode.RATE_LIMITED,
      'Too many contact submissions',
    );
  }

  const body = await readValidatedBody(event, ContactFormSchema.parse);

  logger.info('Contact form submission received', {
    name: body.name,
    email: body.email,
    subject: body.subject,
  });

  return { ok: true };
});

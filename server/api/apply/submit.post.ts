import { ApplyForAccountSchema } from '../../schemas/api-input';

export default defineEventHandler(async (event) => {
  const ip = getClientIp(event);
  const { allowed } = await applyForAccountRateLimiter.check(ip);
  if (!allowed) {
    throw createAppError(
      ErrorCode.RATE_LIMITED,
      'Too many account application submissions',
    );
  }

  const body = await readValidatedBody(event, ApplyForAccountSchema.parse);

  logger.info('Account application received', {
    companyName: body.companyName,
    organizationNumber: body.organizationNumber,
    email: body.email,
  });

  return { ok: true };
});

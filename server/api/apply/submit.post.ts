import { ApplyForAccountSchema } from '../../schemas/api-input';

export default defineEventHandler(async (event) => {
  // ---------------------------------------------------------------------------
  // TODO (M7 — Geins integration): Wire this stub to a real backend.
  // Current behavior: rate-limit + validate + log + return { ok: true }.
  // No real notification or persistence happens.
  //
  // Options (in order of preference):
  //   1. Geins B2B account-application endpoint when it lands on the platform
  //      (tracked under SAL-96 / M7 Platform Wrap-Up). Preferred because it
  //      flows through the same tenant/channel context as the rest of the app.
  //   2. Gmail via the mint-gws plugin — send a notification email to the
  //      tenant's sales contact. Fallback if Geins B2B is not ready by M7.
  //
  // Until one of those is wired, the confirmation shown to the user
  // (`apply.confirmation_message`) reflects that the application is received
  // and handled manually by the sales team.
  // ---------------------------------------------------------------------------
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

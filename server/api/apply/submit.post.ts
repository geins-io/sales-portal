import { GeinsCustomerType } from '@geins/types';
import { ApplyForAccountSchema } from '../../schemas/api-input';
import * as userService from '../../services/user';

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

  // Step 1: create the user as a PERSON via the standard register flow.
  const address = {
    firstName: body.firstName,
    lastName: body.lastName,
    company: body.companyName,
    country: body.country,
  };

  const registerResult = await userService.register(
    { username: body.email, password: body.password },
    { address },
    event,
  );

  if (
    !registerResult?.succeeded ||
    !registerResult.tokens?.token ||
    !registerResult.tokens?.refreshToken
  ) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'Registration failed');
  }

  const { tokens } = registerResult;

  // Step 2: promote the freshly created user to ORGANIZATION. Sales team
  // links the organization to a company manually in Geins Studio afterwards.
  let promotedUser;
  try {
    promotedUser = await userService.updateUser(
      {
        customerType: GeinsCustomerType.OrganizationType,
        address,
      },
      tokens.token!,
      event,
    );
  } catch (err) {
    // The user IS registered as a PERSON at this point. Sales can promote
    // them manually in Studio using the organizationNumber we log here.
    logger.warn('Apply-for-account: updateUser failed after register', {
      email: body.email,
      organizationNumber: body.organizationNumber,
      error: err instanceof Error ? err.message : 'unknown',
    });
    throw createAppError(ErrorCode.BAD_REQUEST, 'Account promotion failed');
  }

  setAuthCookies(event, {
    token: tokens.token!,
    refreshToken: tokens.refreshToken!,
    expiresIn: tokens.expiresIn,
  });

  // Log non-PII fields so the sales team has what they need to link the
  // organization in Studio. Never log password or acceptTerms.
  logger.info('Apply-for-account approved', {
    email: body.email,
    companyName: body.companyName,
    organizationNumber: body.organizationNumber,
    country: body.country,
    phone: body.phone,
    message: body.message,
  });

  return {
    user: promotedUser ?? registerResult.user,
    expiresAt: tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
      : null,
  };
});

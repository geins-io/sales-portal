import { GeinsCustomerType } from '@geins/types';
import { ApplyForAccountSchema } from '../../schemas/api-input';
import * as userService from '../../services/user';

export default defineEventHandler(async (event) => {
  const applyForAccountEnabled =
    event.context?.tenant?.config?.features?.applyForAccount?.enabled ?? true;
  if (!applyForAccountEnabled) {
    throw createAppError(ErrorCode.FORBIDDEN, 'Apply for account is disabled');
  }

  const ip = getClientIp(event);
  const { allowed } = await applyForAccountRateLimiter.check(ip);
  if (!allowed) {
    throw createAppError(
      ErrorCode.RATE_LIMITED,
      'Too many account application submissions',
    );
  }

  const body = await readValidatedBody(event, ApplyForAccountSchema.parse);

  // Geins register still requires a password on the SDK call. We generate
  // a high-entropy one that we never return to the caller or log, so the
  // applicant cannot log in until they go through password reset, which
  // the merchant gates behind manual activation.
  const internalPassword = crypto.randomUUID() + 'Aa1!';

  const address = {
    firstName: body.firstName,
    lastName: body.lastName,
    company: body.companyName,
    country: body.country,
  };

  const registerResult = await userService.register(
    { username: body.email, password: internalPassword },
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

  try {
    await userService.updateUser(
      {
        customerType: GeinsCustomerType.OrganizationType,
        address,
      },
      tokens.token!,
      event,
    );
  } catch (err) {
    logger.warn('Apply-for-account: updateUser failed after register', {
      email: body.email,
      organizationNumber: body.organizationNumber,
      error: err instanceof Error ? err.message : 'unknown',
    });
    throw createAppError(ErrorCode.BAD_REQUEST, 'Account promotion failed');
  }

  // Log only non-PII fields so the sales team has what they need to link
  // the organization in Studio. Never log password or acceptTerms.
  logger.info('Apply-for-account received', {
    email: body.email,
    companyName: body.companyName,
    organizationNumber: body.organizationNumber,
    country: body.country,
  });

  // Do not return tokens or set auth cookies: the applicant must wait for
  // merchant approval before they can sign in. The page renders a
  // thank-you state from the success response.
  return { received: true };
});

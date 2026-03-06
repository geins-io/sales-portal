import * as organizationService from '../../services/organization';
import * as authService from '../../services/auth';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const tokens = await requireAuth(event);

  const authResult = await authService.getUser(
    tokens.refreshToken,
    tokens.authToken,
    event,
  );

  if (!authResult?.succeeded || !authResult.user?.userId) {
    throw createAppError(
      ErrorCode.BAD_REQUEST,
      'Unable to resolve user identity',
    );
  }

  const buyer = await organizationService.getMyBuyerProfile(
    authResult.user.userId,
    event,
  );

  if (!buyer) {
    throw createAppError(ErrorCode.NOT_FOUND, 'Buyer profile not found');
  }

  return { buyer };
});

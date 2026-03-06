import type { H3Event } from 'h3';
import type { Permission, Buyer } from '#shared/types/b2b';
import { DEFAULT_ROLES } from '#shared/types/b2b';
import * as authService from '../services/auth';
import * as organizationService from '../services/organization';
import type { AuthTokens } from './auth';

export interface B2BAuthContext extends AuthTokens {
  buyer: Buyer;
}

/**
 * Require that the current user is a member of an organization.
 * Calls requireAuth first, resolves the userId via authService.getUser,
 * then looks up the buyer profile.
 *
 * @throws 401 if not authenticated
 * @throws 403 if user is not part of any organization
 */
export async function requireOrgMembership(
  event: H3Event,
): Promise<B2BAuthContext> {
  const tokens = await requireAuth(event);

  // Resolve the authenticated user to get their userId
  const authResult = await authService.getUser(
    tokens.refreshToken,
    tokens.authToken,
    event,
  );

  if (!authResult?.succeeded || !authResult.user?.userId) {
    throw createAppError(
      ErrorCode.FORBIDDEN,
      'Unable to resolve user identity',
    );
  }

  const userId = authResult.user.userId;

  let buyer: Buyer | undefined;
  try {
    buyer = await organizationService.getMyBuyerProfile(userId, event);
  } catch {
    // getMyBuyerProfile throws if no buyer found — treat as non-member
  }

  if (!buyer) {
    throw createAppError(
      ErrorCode.FORBIDDEN,
      'Not a member of any organization',
    );
  }

  return { ...tokens, buyer };
}

/**
 * Require that the current user has a specific B2B permission.
 * Calls requireOrgMembership first, then checks the permission
 * against the user's role definition.
 *
 * @throws 401 if not authenticated
 * @throws 403 if not an org member or missing the required permission
 */
export async function requirePermission(
  event: H3Event,
  permission: Permission,
): Promise<B2BAuthContext> {
  const context = await requireOrgMembership(event);
  const roleDef = DEFAULT_ROLES[context.buyer.role];

  if (!roleDef.permissions.includes(permission)) {
    throw createAppError(
      ErrorCode.FORBIDDEN,
      `Missing permission: ${permission}`,
    );
  }

  return context;
}

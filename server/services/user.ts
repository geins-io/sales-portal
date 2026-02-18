import type {
  AuthCredentials,
  AuthResponse,
  GeinsUserType,
  GeinsUserInputTypeType,
} from '@geins/types';
import { AuthError } from '@geins/core';
import type { H3Event } from 'h3';
import { getTenantSDK } from './_sdk';
import { ErrorCode } from '../utils/errors';

export async function getUser(
  userToken: string,
  event: H3Event,
): Promise<GeinsUserType | undefined> {
  const { crm } = await getTenantSDK(event);
  return wrapServiceCall(
    () => crm.user.get(userToken),
    'user',
    AuthError,
    ErrorCode.UNAUTHORIZED,
  );
}

export async function updateUser(
  userData: GeinsUserInputTypeType,
  userToken: string,
  event: H3Event,
): Promise<GeinsUserType | undefined> {
  const { crm } = await getTenantSDK(event);
  return wrapServiceCall(
    () => crm.user.update(userData, userToken),
    'user',
    AuthError,
    ErrorCode.UNAUTHORIZED,
  );
}

export async function changePassword(
  credentials: AuthCredentials,
  refreshToken: string,
  event: H3Event,
): Promise<AuthResponse | undefined> {
  const { crm } = await getTenantSDK(event);
  return wrapServiceCall(
    () => crm.user.password.change(credentials, refreshToken),
    'user',
    AuthError,
    ErrorCode.UNAUTHORIZED,
  );
}

export async function register(
  credentials: AuthCredentials,
  user: GeinsUserInputTypeType | undefined,
  event: H3Event,
): Promise<AuthResponse | undefined> {
  const { crm } = await getTenantSDK(event);
  return wrapServiceCall(
    () => crm.user.create(credentials, user),
    'user',
    AuthError,
    ErrorCode.UNAUTHORIZED,
  );
}

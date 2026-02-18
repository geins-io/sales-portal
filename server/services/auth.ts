import type { AuthCredentials, AuthResponse } from '@geins/types';
import { AuthError } from '@geins/core';
import type { H3Event } from 'h3';
import { getTenantSDK } from './_sdk';
import { ErrorCode } from '../utils/errors';

export async function login(
  credentials: AuthCredentials,
  event: H3Event,
): Promise<AuthResponse | undefined> {
  const { crm } = await getTenantSDK(event);
  return wrapServiceCall(
    () => crm.auth.login(credentials),
    'auth',
    AuthError,
    ErrorCode.UNAUTHORIZED,
  );
}

export async function logout(
  event: H3Event,
): Promise<AuthResponse | undefined> {
  const { crm } = await getTenantSDK(event);
  return wrapServiceCall(
    () => crm.auth.logout(),
    'auth',
    AuthError,
    ErrorCode.UNAUTHORIZED,
  );
}

export async function refresh(
  refreshToken: string,
  event: H3Event,
): Promise<AuthResponse | undefined> {
  const { crm } = await getTenantSDK(event);
  return wrapServiceCall(
    () => crm.auth.refresh(refreshToken),
    'auth',
    AuthError,
    ErrorCode.UNAUTHORIZED,
  );
}

export async function getUser(
  refreshToken: string,
  userToken: string | undefined,
  event: H3Event,
): Promise<AuthResponse | undefined> {
  const { crm } = await getTenantSDK(event);
  return wrapServiceCall(
    () => crm.auth.getUser(refreshToken, userToken),
    'auth',
    AuthError,
    ErrorCode.UNAUTHORIZED,
  );
}

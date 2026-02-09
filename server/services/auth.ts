import type { AuthCredentials, AuthResponse } from '@geins/types';
import { AuthError } from '@geins/core';
import type { H3Event } from 'h3';
import { getTenantSDK } from './_sdk';

export async function login(
  credentials: AuthCredentials,
  event: H3Event,
): Promise<AuthResponse | undefined> {
  const { crm } = await getTenantSDK(event);
  try {
    return await crm.auth.login(credentials);
  } catch (error) {
    if (error instanceof AuthError) {
      throw createAppError(ErrorCode.UNAUTHORIZED, error.message);
    }
    throw createAppError(ErrorCode.EXTERNAL_API_ERROR, 'Login failed');
  }
}

export async function logout(
  event: H3Event,
): Promise<AuthResponse | undefined> {
  const { crm } = await getTenantSDK(event);
  try {
    return await crm.auth.logout();
  } catch (error) {
    if (error instanceof AuthError) {
      throw createAppError(ErrorCode.UNAUTHORIZED, error.message);
    }
    throw createAppError(ErrorCode.EXTERNAL_API_ERROR, 'Logout failed');
  }
}

export async function refresh(
  refreshToken: string,
  event: H3Event,
): Promise<AuthResponse | undefined> {
  const { crm } = await getTenantSDK(event);
  try {
    return await crm.auth.refresh(refreshToken);
  } catch (error) {
    if (error instanceof AuthError) {
      throw createAppError(ErrorCode.UNAUTHORIZED, error.message);
    }
    throw createAppError(ErrorCode.EXTERNAL_API_ERROR, 'Token refresh failed');
  }
}

export async function getUser(
  refreshToken: string,
  userToken: string | undefined,
  event: H3Event,
): Promise<AuthResponse | undefined> {
  const { crm } = await getTenantSDK(event);
  try {
    return await crm.auth.getUser(refreshToken, userToken);
  } catch (error) {
    if (error instanceof AuthError) {
      throw createAppError(ErrorCode.UNAUTHORIZED, error.message);
    }
    throw createAppError(ErrorCode.EXTERNAL_API_ERROR, 'Failed to get user');
  }
}

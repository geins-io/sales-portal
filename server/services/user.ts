import type {
  AuthCredentials,
  AuthResponse,
  GeinsUserType,
  GeinsUserInputTypeType,
} from '@geins/types';
import { AuthError } from '@geins/core';
import type { H3Event } from 'h3';
import { getTenantSDK } from './_sdk';

export async function getUser(
  userToken: string,
  event: H3Event,
): Promise<GeinsUserType | undefined> {
  const { crm } = await getTenantSDK(event);
  try {
    return await crm.user.get(userToken);
  } catch (error) {
    if (error instanceof AuthError) {
      throw createAppError(ErrorCode.UNAUTHORIZED, error.message);
    }
    throw createAppError(ErrorCode.EXTERNAL_API_ERROR, 'Failed to get user');
  }
}

export async function updateUser(
  userData: GeinsUserInputTypeType,
  userToken: string,
  event: H3Event,
): Promise<GeinsUserType | undefined> {
  const { crm } = await getTenantSDK(event);
  try {
    return await crm.user.update(userData, userToken);
  } catch (error) {
    if (error instanceof AuthError) {
      throw createAppError(ErrorCode.UNAUTHORIZED, error.message);
    }
    throw createAppError(ErrorCode.EXTERNAL_API_ERROR, 'Failed to update user');
  }
}

export async function changePassword(
  credentials: AuthCredentials,
  refreshToken: string,
  event: H3Event,
): Promise<AuthResponse | undefined> {
  const { crm } = await getTenantSDK(event);
  try {
    return await crm.user.password.change(credentials, refreshToken);
  } catch (error) {
    if (error instanceof AuthError) {
      throw createAppError(ErrorCode.UNAUTHORIZED, error.message);
    }
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      'Failed to change password',
    );
  }
}

export async function register(
  credentials: AuthCredentials,
  user: GeinsUserInputTypeType | undefined,
  event: H3Event,
): Promise<AuthResponse | undefined> {
  const { crm } = await getTenantSDK(event);
  try {
    return await crm.user.create(credentials, user);
  } catch (error) {
    if (error instanceof AuthError) {
      throw createAppError(ErrorCode.UNAUTHORIZED, error.message);
    }
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      'Failed to register user',
    );
  }
}

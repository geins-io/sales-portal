import type { AuthCredentials, AuthResponse } from '@geins/types';
import type { H3Event } from 'h3';
import { getGeinsClient } from './_client';

export async function login(
  credentials: AuthCredentials,
  event: H3Event,
): Promise<AuthResponse | undefined> {
  const { crm } = await getGeinsClient(event);
  return crm.auth.login(credentials);
}

export async function logout(
  refreshToken: string,
  event: H3Event,
): Promise<AuthResponse | undefined> {
  const { crm } = await getGeinsClient(event);
  crm.setAuthTokens({ refreshToken });
  return crm.auth.logout();
}

export async function refresh(
  refreshToken: string,
  event: H3Event,
): Promise<AuthResponse | undefined> {
  const { crm } = await getGeinsClient(event);
  return crm.auth.refresh(refreshToken);
}

export async function getUser(
  refreshToken: string,
  userToken: string | undefined,
  event: H3Event,
): Promise<AuthResponse | undefined> {
  const { crm } = await getGeinsClient(event);
  return crm.auth.get(refreshToken, userToken);
}

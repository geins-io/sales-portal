import type {
  AuthCredentials,
  AuthResponse,
  GeinsUserType,
  GeinsUserInputTypeType,
} from '@geins/types';
import type { H3Event } from 'h3';
import { getGeinsClient } from './_client';

// User operations require setAuthTokens() before each call because the SDK
// user interface doesn't accept per-operation tokens (unlike auth.get/refresh).
// Safe with per-tenant singletons: setAuthTokens + the SDK's synchronous token
// read in the operation builder run in the same tick — no interleaving in Node.

export async function getUser(
  refreshToken: string,
  event: H3Event,
): Promise<GeinsUserType | undefined> {
  const { crm } = await getGeinsClient(event);
  crm.setAuthTokens({ refreshToken });
  return crm.user.get();
}

export async function updateUser(
  userData: GeinsUserInputTypeType,
  refreshToken: string,
  event: H3Event,
): Promise<GeinsUserType> {
  const { crm } = await getGeinsClient(event);
  crm.setAuthTokens({ refreshToken });
  return crm.user.update(userData);
}

export async function changePassword(
  credentials: AuthCredentials,
  refreshToken: string,
  event: H3Event,
): Promise<AuthResponse | undefined> {
  const { crm } = await getGeinsClient(event);
  crm.setAuthTokens({ refreshToken });
  return crm.user.password.change(credentials);
}

export async function register(
  credentials: AuthCredentials,
  user: GeinsUserInputTypeType | undefined,
  event: H3Event,
): Promise<AuthResponse | undefined> {
  const { crm } = await getGeinsClient(event);
  return crm.user.create(credentials, user);
}

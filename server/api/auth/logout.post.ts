import * as authService from '../../services/auth';

export default defineEventHandler(async (event) => {
  // Clear cookies first — always succeeds
  deleteCookie(event, 'auth_token', { path: '/' });
  deleteCookie(event, 'refresh_token', { path: '/' });

  // Best-effort server-side logout — don't fail if Geins API errors
  try {
    await authService.logout(event);
  } catch {
    // Ignore — cookies are already cleared
  }

  return { success: true };
});

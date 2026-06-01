import { clearStoreSettingsPreviewCookie } from '../../utils/cookies';

export default defineEventHandler((event) => {
  clearStoreSettingsPreviewCookie(event);
  return { success: true };
});

export default defineEventHandler((event) => {
  clearPreviewSession(event);
  return { success: true };
});

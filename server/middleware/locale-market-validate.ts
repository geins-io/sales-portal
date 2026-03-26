/**
 * Validation moved to server/plugins/01.tenant-context.ts — this
 * middleware is kept as a placeholder and can be deleted.
 */
export default defineEventHandler(() => {
  // No-op: locale/market validation is now handled by the tenant context plugin.
});

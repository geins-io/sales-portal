/**
 * Fallback /api/* handler.
 *
 * Nitro routes specific handlers first (e.g. /api/products, /api/auth/login),
 * so this catch-all only fires when no other handler matches the incoming
 * request. Without it, unmatched /api/* paths fell through to Nuxt's Vue
 * Router and served the storefront HTML with a 200 status — bad for API
 * clients and for scanners that treat 200 HTML as a valid endpoint.
 *
 * Keep this file the lowest-specificity handler in server/api/ so it never
 * shadows a real route.
 */
export default defineEventHandler((event) => {
  throw createError({
    statusCode: 404,
    statusMessage: 'Not Found',
    message: `No handler for ${event.method} ${event.path}`,
  });
});

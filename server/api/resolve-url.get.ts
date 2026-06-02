import { ResolveUrlSchema } from '../schemas/api-input';
import { resolveEntityUrl } from '../services/url-resolver';

/**
 * Inbound URL resolver endpoint: the 404-miss safety net (spec 012 wires the
 * catch-all to it). Never cached (it is the miss path, and a freshly created
 * entity must resolve on the next request). The `path` query param is the
 * normalized prefix-less inbound path; the alias is its last non-empty segment.
 */
export default defineEventHandler(async (event) => {
  const { path } = ResolveUrlSchema.parse(getQuery(event));
  const auth = await optionalAuth(event);

  // Miss path: never cache. A newly published entity must resolve next time.
  setResponseHeader(event, 'Cache-Control', 'no-store');

  return withErrorHandling(
    async () => {
      const segments = path.split('/').filter(Boolean);
      const alias = segments[segments.length - 1] ?? '';

      const result = await resolveEntityUrl(
        { path, alias, userToken: auth?.authToken },
        event,
      );
      if (!result) {
        throw createAppError(ErrorCode.NOT_FOUND, 'No entity for URL');
      }
      return result;
    },
    { operation: 'resolve-url.get' },
  );
});

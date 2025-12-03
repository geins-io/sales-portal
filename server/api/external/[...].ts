import { joinURL } from 'ufo';

export default defineEventHandler(async (event) => {
  // Remove the `/external/api` prefix from the path
  const targetPath = event.path.replace(/^\/api\/external\//, '');
  // Set the request target utilizing our external API's base URL and the tenant ID
  const target = joinURL(
    'https://api.app.com',
    event.context.tenant.id,
    targetPath,
  );
  // Determine the request body when applicable
  const requestBody = ['PATCH', 'POST', 'PUT', 'DELETE'].includes(event.method)
    ? await readRawBody(event, false)
    : undefined;

  return sendProxy(event, target, {
    headers: {
      // Add necessary request headers as needed
      // e.g. `Cookie`, `Accept`, `Content-Type`, etc.
    },
    fetchOptions: {
      method: event.method,
      body: requestBody,
    },
  });
});

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', async (event) => {
    // Get the request host for dynamic request routing
    // without considering the `X-Forwarded-Host` header which could be spoofed.
    const hostname = getRequestHost(event, { xForwardedHost: false });
    const id = await useStorage('kv').getItem<string>(`tenant:id:${hostname}`);

    // Attach tenant data to the event context to make it
    // available to all server routes and middleware.
    event.context.tenant = { id: id ?? '', hostname: hostname ?? '' };
  });
});

export default defineNuxtPlugin(() => {
  const requestHeaders = useRequestHeaders();

  const api = $fetch.create({
    onRequest({ options }) {
      options.headers = {
        ...(options.headers || {}),
        // Always include the original client request headers
        ...requestHeaders,
        // Add custom tenant-specific headers to all requests that
        // go through our custom $fetch instance
      };
    },
  });

  return {
    provide: { api }, // Expose helper to useNuxtApp().$api
  };
});

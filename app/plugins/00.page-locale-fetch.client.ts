import { sendPageLocaleWithFetch } from '~/utils/page-locale-fetch';

// First, so every fetch to our own /api routes, the plugins' included, carries
// the page's language. ofetch, and with it useFetch and $fetch, calls the
// global fetch on each request.
export default defineNuxtPlugin({
  name: 'page-locale-fetch',
  enforce: 'pre',
  setup() {
    sendPageLocaleWithFetch(window, () => window.location);
  },
});

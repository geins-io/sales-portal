/**
 * Whether the server is running under `nuxt dev`.
 *
 * `import.meta.dev` is a build-time constant: true in the dev server, false
 * in `nuxt build` output (preview, the production image) and in the node
 * test tier. Isolated in its own module so unit tests can mock it and cover
 * both the development and the production behaviour of a dev-only feature.
 */
export function isDevMode(): boolean {
  return import.meta.dev;
}

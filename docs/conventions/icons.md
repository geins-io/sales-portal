# Icons

We use `@nuxt/icon` with the `lucide` collection. Configured in `nuxt.config.ts`
under the `icon` key.

## How icon resolution works

Nuxt Icon resolves a `<Icon name="lucide:foo" />` reference in one of three ways,
in order of preference:

1. **Client bundle hit (zero network).** The icon SVG was embedded into the JS
   bundle at build time. Renders instantly on both SSR and client-side
   navigation. This is the desired path.
2. **Server bundle hit via `/api/_nuxt_icon` (one round-trip).** Used as fallback
   when the client bundle has no entry for the requested icon. The client fetches
   the SVG from a Nitro endpoint backed by `serverBundle.collections`. ~10-30ms
   per icon on cold cache, browser-cached afterwards. Visible as a brief
   "icons popping in" flicker after first paint.
3. **Silent failure.** If the API endpoint is unreachable (CSP block, Nitro
   crash, middleware bug, network drop), the icon renders as nothing. No error,
   no fallback glyph.

We pre-bundle the chrome icons (header, footer, tabs, stat cards) into the
client bundle so they never go through path 2 or 3.

## The rule

**Prefer static literal icon names so the build-time scanner can find them.**

```vue
<!-- Good: scanner sees "lucide:download" and includes it in the bundle -->
<Icon name="lucide:download" class="size-4" />

<!-- Good: scanner sees both branches as literals -->
<Icon :name="isDark ? 'lucide:moon' : 'lucide:sun'" />

<!-- Bad: template literal — scanner cannot resolve the name at build time -->
<Icon :name="`lucide:${variant}`" />

<!-- Bad: prop, computed, or map lookup — scanner cannot see what's passed -->
<Icon :name="iconNameFromProp" />
<Icon :name="ICON_MAP[key]" />
```

`clientBundle.scan: true` in `nuxt.config.ts` discovers every static literal
automatically. Static usage is free — add new ones without touching config.

## When you must use a dynamic name

Sometimes you genuinely need a dynamic name: an icon stored in a tab config
array, a social-icon map, a tenant-driven menu entry. Two requirements:

1. **List every possible value in `nuxt.config.ts` under `icon.clientBundle.icons`.**
   Group the entries by source file with a comment so the next contributor knows
   where to add new ones.
2. **Restrict the name to a known enum.** Do not let arbitrary runtime input
   (e.g. raw CMS strings, tenant config without validation) flow directly into
   `<Icon :name="...">`. Anything not in the allowlist will silently render as
   blank in production. Validate or map to a closed set.

## Adding a new icon

| Scenario                             | Action                                                             |
| ------------------------------------ | ------------------------------------------------------------------ |
| Static literal in a `.vue` file      | None. `clientBundle.scan` picks it up at build.                    |
| New prop-driven or map-driven icon   | Add to `nuxt.config.ts` `icon.clientBundle.icons`.                 |
| Icon name from tenant/CMS at runtime | Map to a fixed enum in code first, then bundle that enum's values. |

## Verifying

After adding icons, verify both paths:

1. **Hard refresh** the page that uses the icon. Icon must appear immediately
   on the first paint (SSR path — always works if the icon is anywhere in
   `serverBundle`).
2. **Client-side navigate** to and from the page (click a link, do not refresh).
   Icon must appear without flicker. If it flashes blank for a moment, it is
   coming from the server endpoint and is missing from the client bundle —
   add it to `icon.clientBundle.icons`.

DevTools network tab is the diagnostic: filter by `_nuxt_icon` and watch for
requests during client navigation. Any request that fires is an icon that
should be in the client bundle.

## Background

Originally we used `serverBundle.collections: ['lucide']` alone (PR #165). It
makes SSR work and gives the runtime fallback endpoint a full collection, but
it leaves the client bundle empty — every icon on a client-navigated page
costs a round-trip and depends on the API endpoint staying healthy. Adding
`clientBundle.scan: true` + an explicit allowlist for dynamic names removes
that runtime dependency for the chrome icons.

The `serverBundle` stays as a safety net: any icon name we forget to bundle
client-side still resolves via the endpoint, just with a flicker. We never
want a fully-broken icon, just a slightly slower one.

---
title: Images are sized by the asset CDN, not by the portal
status: accepted
created: 2026-10-19
author: '@geins'
tags: [images, performance, cdn]
---

# ADR-025: Images are sized by the asset CDN, not by the portal

## Context

Product and CMS images were served as their full-size originals. `@nuxt/image`
was installed with `image.domains: ['commerce.services']`, but that allowlist
compares hosts exactly and the real host is `{account}.commerce.services`, so
no image ever reached its optimiser. An allowlist cannot express a per-tenant
host either.

That legacy host only serves pre-generated folders (`raw`, `40x40`,
`100x100`) and ignores query parameters. Accounts moved to Geins's asset
library get a `url` per image on a CDN that resizes and re-encodes on request:
`width`, `format=auto` (AVIF or WebP from the `Accept` header), and more.

Resizing in the portal (IPX) would put image work on the app servers and
needs a host allowlist per tenant. `@nuxt/image`'s Fastly provider needs a
fixed `baseURL` and maps `fit` to values the CDN does not mean.

## Decision

The portal builds image URLs itself, in `shared/utils/image.ts`
(`buildImageSources`, and `buildCoverSources` for a box of fixed height), and
`GeinsImage` renders a plain `<img>`, or a `<picture>` for such a box:

- An image with a library `url` gets a width ladder
  (`?width=<n>&format=auto` for each step) as `srcset`, and each call site
  states its rendered width as `sizes`, so the browser picks the file.
- An image without one is served exactly as before: the legacy raw file, one
  URL, no `srcset`. The choice is per image, so a mixed catalogue works.
- The request parameters are kept to `width`, `height`, `fit` and `format`.
  `height` and `fit` are sent only for an image its box crops: `fit=crop`
  with the height of a box of fixed ratio, `fit=cover` per viewport range for
  a box of fixed height. Without `fit` the CDN stretches the image to both
  sizes. Crawlers get the library image at `width=1200` in its original
  format.
- The page's largest image is marked by the caller (`priority`) and gets
  `fetchpriority="high"` without `decoding="async"`, a head preload built from
  the same candidates, and a preconnect to the library origin.

_Amended 2026-10-20: `height` and `fit` were added, and `buildCoverSources`
next to `buildImageSources`. Width alone left a crop short of its box whenever
the source was wider than the box._

`@nuxt/image` is removed, with its config and the server plugin that stripped
its inline `onerror` attribute.

## Consequences

- No image processing on the portal's servers, and no per-tenant allowlist.
- Accounts outside the asset library keep their legacy image URLs, full-size
  originals, until they are moved.
- The API returns no image dimensions yet, so the ladder is not capped at the
  source width and natural-fit CMS images can shift layout while loading.
- The CDN caches for an hour (`max-age=3600`), against a year on the legacy
  host.
- Every image goes through `GeinsImage`; a new image surface must state its
  `sizes`, or it is sized for the full viewport width.

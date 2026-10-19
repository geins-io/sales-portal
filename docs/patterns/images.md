# Images

Every product and CMS image renders through `GeinsImage`
(`app/components/shared/GeinsImage.vue`), which takes its URLs from
`buildImageSources` in `shared/utils/image.ts`. Why the portal builds them
itself instead of using an image module: [ADR-025](../adr/025-images-sized-by-the-asset-cdn.md).

## Where an image comes from

One image, first match wins:

| Input                                          | Served from                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| `url` (the API's asset library URL)            | the library CDN, one URL per width: `?width=<n>&format=auto`              |
| `path` (CMS configuration) + tenant asset base | the same, built as `<assetBaseUrl>/<path>`                                |
| `fileName`                                     | the legacy host, raw: `{account}.commerce.services/{type}/raw/{fileName}` |

A legacy image gets one URL and no `srcset`, exactly as before the library
existed. The choice is per image, so a product with old and new images works.
`assetBaseUrl` stays empty until the channel carries the CDN host; until then a
CMS image with only a `path` is served from its legacy file.

## Rendering one

```vue
<GeinsImage
  :file-name="image.fileName"
  :url="image.url"
  type="product"
  :alt="name"
  sizes="(min-width: 768px) 400px, calc(100vw - 66px)"
/>
```

- **`sizes`** is the width the image is shown at, per breakpoint. The browser
  picks a file from it, so a wrong value means a blurry or an oversized image.
  The default is `100vw`; every call site sets its own.
- **`widths`** replaces the default ladder (160–2560). Thumbnails shown at
  40–64 px use `THUMBNAIL_WIDTHS` (80, 160, 240).
- **`priority`** marks the page's largest image: eager, `fetchpriority="high"`,
  without `decoding="async"`, preloaded from the head with the same candidates and
  `sizes`, and the CDN origin preconnected. Give it to one image per page.
- **`loading`** stays `lazy` by default. Product grids pass the card's
  `index`: card 0 gets `priority`, cards 1–3 load eagerly, the rest lazily.

## Which image gets priority

| Page                               | Image                                                                 |
| ---------------------------------- | --------------------------------------------------------------------- |
| Product list, search, all products | the first card (`ProductCard` `index` 0)                              |
| Product page                       | the gallery's main image                                              |
| Start page, portal hero, CMS pages | the first image of the first widget, through `CmsWidgetArea priority` |

A CMS area that does not open the page (the product list's top and bottom
areas, the product page's area) does not take `priority`.

## Print-only images

An image that only print shows sits in a `hidden` section with
`loading="lazy"`: Chromium and WebKit do not fetch a lazy image under
`display: none`, and print loads it when the section shows. Firefox is
unverified.

## Crawlers

`og:image` and the Schema.org product images use `buildShareImageUrl`: the
library image at `width=1200` in its original format, so any crawler can read
it, else the legacy raw file.

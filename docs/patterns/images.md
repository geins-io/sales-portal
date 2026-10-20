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

## How big a library image is asked for

The URL depends on the box the image fills:

| Box                                                            | Request per candidate                                          | `srcset`                              |
| -------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------- |
| Keeps the image's shape (`fit="natural"`, `contain`, no ratio) | `?width=<w>&format=auto`                                       | `w` per ladder step                   |
| Crops at a fixed ratio (`cover` + `aspectRatio`)               | `?width=<w>&height=<w ÷ ratio>&fit=crop&format=auto`           | `w` per ladder step                   |
| Crops at a fixed height (`cover` + `coverHeight`)              | `?width=<range × k>&height=<height × k>&fit=cover&format=auto` | `1x`–`3x` per range, in a `<picture>` |

`fit=crop` is the CDN's centre crop, the same crop as `object-cover`, so the
crop is never short of the box when the source is wider than it. `fit=cover`
returns the whole image scaled to cover both sizes, and `object-cover` crops
it. Without `fit` the CDN stretches the image to both sizes, so `height` never
goes without it. The CDN never upscales: a request larger than the source
returns the source.

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
- **`aspectRatio`** (`1`, `16/9`) shapes the box, and a `cover` image is asked
  for in that shape. Give the ratio to `GeinsImage`, not only to a parent's
  `aspect-*` class: the URL cannot see a parent's ratio.
- **`coverHeight`** is the height in css px of a `cover` box whose width
  follows the viewport, such as the full-width banner. The image is asked for
  per viewport range in `COVER_RANGES`, at 1x to 3x.
- **`priority`** marks the page's largest image: eager, `fetchpriority="high"`,
  without `decoding="async"`, preloaded from the head with the same candidates and
  `sizes`, and the CDN origin preconnected. A `coverHeight` image gets one
  preload per viewport range, each with that range's `media`, so only one is
  fetched. Give it to one image per page.
- **`loading`** stays `lazy` by default. Product grids pass the card's
  `index`: card 0 gets `priority`, cards 1–3 load eagerly, the rest lazily.
- **`mobile`** is a separate image for viewports below 768 px (`MOBILE_MEDIA`),
  given as `{ url, path, fileName }` and located in the same order as the
  image itself. See below.

## A separate mobile image

The Image and Banner widgets let an editor pick a second image under
**Mobile** (`filenameForMobileDevice`, `pathForMobileDevice`, plus its own
entry in the widget's `images`). `widgetMobileImage` in
`shared/utils/cms-image.ts` locates it, and `GeinsImage` switches to it with a
`<picture>`:

| Box                                     | Sources                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| Sized by width (Image, non-full Banner) | mobile below 768 px, desktop from 768 px, both with the img's `sizes`; the img keeps desktop |
| Fixed height (`coverHeight`)            | the mobile image takes the first `COVER_RANGES` range; the other three stay desktop          |

- **One `<picture>`, not two imgs.** The browser picks one source, so a phone
  fetches only the mobile file and it is the LCP image. A hidden second
  `<img>` that is eager or `priority` is still fetched.
- **The viewport decides, not the widget's width.** A `<source media>` sees
  only the viewport. Below 768 px containers stack to one column, so the
  widget is phone-wide anyway, except a quarter widget from 640 px.
- **Each image resolves on its own.** A library desktop image can have a
  legacy mobile image, or the reverse. A legacy image is one raw candidate.
- **Priority** preloads each source for its own `media`, with that source's
  candidates and `sizes`, so exactly one preload matches and it is the file
  the `<picture>` picks.
- **The box can change shape at 768 px.** A width-sized box follows the image
  that was picked. A fixed-height box crops either one.
- Without a mobile image nothing changes: no `<picture>` for a width-sized box,
  the same four ranges for a fixed-height one.

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
`loading="eager"`, so it is fetched with the page. A lazy image under
`display: none` is not fetched on screen, and `window.print()` lays the page
out at once, before the image that print has just revealed arrives: the data
sheet's button printed grey boxes. Keep these tiles small (`PRINT_TILE_WIDTHS`),
since every view pays for them.

## Crawlers

`og:image` and the Schema.org product images use `buildShareImageUrl`: the
library image at `width=1200` in its original format, so any crawler can read
it, else the legacy raw file.

/**
 * Default parameter-name → media-kind mapping, used when a tenant hasn't
 * configured its own via `tenant.productMediaParameters` (see
 * shared/types/tenant-config.ts). Mirrors the `cms.slots`/`cms.menus`
 * pattern in shared/types/cms-slots.ts: parameter naming is decided by
 * whichever backend feeds a tenant's product data (PIM / merchant admin),
 * and Geins admin lets each merchant name their own parameters freely —
 * hardcoding one naming convention here would break any tenant whose PIM
 * calls the same concept something else (`Datasheet` instead of `Manual`,
 * for example). This table is only the seed every tenant starts from;
 * `classifyMediaParameter` always takes the tenant's resolved table
 * (defaults merged with that tenant's overrides, computed server-side in
 * server/utils/tenant.ts and delivered via PublicTenantConfig) as an
 * explicit argument rather than reading this constant directly.
 *
 * Keys are matched case-insensitively against a parameter's `identifier`,
 * which Geins documents as the same across every language and stable when
 * the display name changes, falling back to `name` only where a parameter
 * carries no identifier. Never the localized `label`.
 *
 * A key match alone is not enough: `classifyMediaParameter` also requires
 * the value to look like a URL, so a parameter like `ProductSpec` that's
 * sometimes filled with plain text instead of a link falls through to a
 * normal spec row automatically.
 */
export const PRODUCT_MEDIA_PARAMETER_DEFAULTS: Record<
  string,
  'video' | 'document'
> = {
  videourl: 'video',
  manual: 'document',
  productspec: 'document',
};

export type ProductMediaKind = 'video' | 'document';

/**
 * How an entry should be presented.
 *
 * The distinction exists because a `<video>` element can only play a URL
 * that points at an actual video file. Handing it a provider *page* URL
 * (a Shorts link, a Loom share link) renders a player that silently plays
 * nothing, so anything neither embeddable nor a file has to degrade to a
 * link the shopper can follow instead.
 */
export type ProductMediaDisplay = 'embed' | 'file' | 'link';

/**
 * Format family derived from the URL's extension, used to pick an icon.
 * Deliberately a family rather than a specific format: the icon set has no
 * brand marks (no PDF/Word/Excel glyphs), so `doc` and `txt` land on the
 * same icon anyway. `pdf` stays its own value despite currently sharing an
 * icon with `text`, since it's the dominant format here and the likeliest
 * to earn distinct treatment later.
 */
export type ProductMediaFileType =
  | 'pdf'
  | 'text'
  | 'spreadsheet'
  | 'archive'
  | 'image'
  | 'video'
  | 'audio'
  | 'cad'
  | 'code';

export interface ProductMediaParameter {
  kind: ProductMediaKind;
  label: string;
  url: string;
  /** Iframe-embeddable URL for known video providers; null otherwise. */
  embedUrl: string | null;
  display: ProductMediaDisplay;
  /**
   * Format family, or null when the URL carries no recognizable file
   * extension — those open a page rather than downloading something, which
   * is worth signalling differently to a shopper deciding whether to click.
   */
  fileType: ProductMediaFileType | null;
  /**
   * The file's own name, or null when the URL doesn't end in one.
   *
   * `label` comes from the parameter, so every entry of a multi-value
   * parameter shares it — three files under `Manual` all read "Manual".
   * The file name is the only thing that differs per entry, so it's what
   * lets a shopper tell them apart. Opaque names (`5590_1.pdf`) still
   * distinguish even when they don't describe.
   */
  fileName: string | null;
}

const URL_PATTERN = /^https?:\/\//i;

/**
 * Extension → format family. Also the single source of truth for which
 * extensions a browser can play in a `<video>` element (everything mapped
 * to `video`), so the two never drift apart.
 */
const FILE_TYPE_BY_EXTENSION: Record<string, ProductMediaFileType> = {
  pdf: 'pdf',
  doc: 'text',
  docx: 'text',
  odt: 'text',
  rtf: 'text',
  txt: 'text',
  md: 'text',
  xls: 'spreadsheet',
  xlsx: 'spreadsheet',
  ods: 'spreadsheet',
  csv: 'spreadsheet',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
  bmp: 'image',
  tiff: 'image',
  mp4: 'video',
  webm: 'video',
  ogv: 'video',
  ogg: 'video',
  mov: 'video',
  m4v: 'video',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
  aac: 'audio',
  flac: 'audio',
  dwg: 'cad',
  dxf: 'cad',
  step: 'cad',
  stp: 'cad',
  iges: 'cad',
  igs: 'cad',
  stl: 'cad',
  json: 'code',
  xml: 'code',
  yaml: 'code',
  yml: 'code',
};

/**
 * Separator for a parameter holding several files (two manuals, a spec
 * sheet plus a CAD drawing). RFC 3986 excludes `|` from the characters a
 * URL may carry unencoded — it has to appear as `%7C` — so splitting on it
 * can never cut a well-formed URL in half, which is why it's preferred
 * over a comma or semicolon here.
 */
const MULTI_VALUE_SEPARATOR = '|';

function isUrlValue(value: string | undefined): value is string {
  return !!value && URL_PATTERN.test(value.trim());
}

/** Turns a PascalCase/camelCase technical key into a spaced display label. */
function formatParameterLabel(raw: string): string {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lowercased extension of the URL's last path segment, or '' when it has
 * none. Query and fragment are stripped first: a signed CDN link
 * (`clip.mp4?token=…`) is still a direct file.
 */
/**
 * The URL's path, without the origin. Splitting the raw string on '/' instead
 * would hand back the host for a URL that has no path, so `https://demo.mov`
 * reads as a .mov file and renders a <video> pointed at an HTML page — the
 * dead player `display: 'link'` exists to avoid. Every caller runs after
 * isUrlValue, so the value is an absolute http(s) URL and parses.
 */
function urlPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
}

function fileExtension(url: string): string {
  const lastSegment = urlPath(url).split('/').pop() ?? '';
  const dot = lastSegment.lastIndexOf('.');
  return dot === -1 ? '' : lastSegment.slice(dot + 1).toLowerCase();
}

function resolveFileType(url: string): ProductMediaFileType | null {
  return FILE_TYPE_BY_EXTENSION[fileExtension(url)] ?? null;
}

/**
 * The URL's last path segment when it looks like a file, decoded so an
 * encoded name (`Installations%20manual.pdf`) reads normally. Null for a
 * URL that ends in a directory or a route rather than a file — there is
 * nothing useful to show a shopper in that case.
 */
function resolveFileName(url: string): string | null {
  const lastSegment = urlPath(url).split('/').pop() ?? '';
  if (!lastSegment.includes('.')) return null;
  try {
    return decodeURIComponent(lastSegment);
  } catch {
    // Malformed percent-encoding: the raw segment still identifies the file.
    return lastSegment;
  }
}

/** True when the URL points at a video file a browser can play directly. */
function isDirectVideoFile(url: string): boolean {
  return resolveFileType(url) === 'video';
}

/**
 * Picks how one entry should be rendered. Documents are always links — a
 * link degrades safely whatever it points at. Videos prefer a provider
 * embed, fall back to the browser's own player for a direct file, and
 * otherwise become a link rather than a player that cannot play.
 */
function resolveDisplay(
  kind: ProductMediaKind,
  url: string,
  embedUrl: string | null,
): ProductMediaDisplay {
  if (kind === 'document') return 'link';
  if (embedUrl) return 'embed';
  return isDirectVideoFile(url) ? 'file' : 'link';
}

/**
 * Resolves a raw video URL to an embeddable iframe src for known providers.
 * Returns null for anything else — a direct file (played in a `<video>`
 * element) or a provider we don't recognize (rendered as a link).
 */
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const YOUTUBE_SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be']);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

/** The id in a /embed/{id}, /shorts/{id} or /v/{id} path, or null. */
function pathId(pathname: string, prefixes: string[]): string | null {
  for (const prefix of prefixes) {
    if (!pathname.startsWith(prefix)) continue;
    const id = pathname.slice(prefix.length).split('/')[0] ?? '';
    if (/^[\w-]+$/.test(id)) return id;
  }
  return null;
}

export function resolveVideoEmbedUrl(url: string): string | null {
  // Matched against the parsed hostname, never the raw string: a substring
  // test treats `https://evil-youtube.com/watch?v=abc` as YouTube, because
  // `youtube.com/watch?v=` really does occur inside that host. The rebuilt
  // embed URL keeps the iframe on youtube.com either way, but the page still
  // presents an unrelated host's link as though the provider vouched for it.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.has(host)) {
    const watch = parsed.searchParams.get('v');
    const id =
      (watch && /^[\w-]+$/.test(watch) ? watch : null) ??
      pathId(parsed.pathname, ['/embed/', '/shorts/', '/v/']);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  if (YOUTUBE_SHORT_HOSTS.has(host)) {
    const id = pathId(parsed.pathname, ['/']);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  if (VIMEO_HOSTS.has(host)) {
    const id = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
    return /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }

  return null;
}

/**
 * Classifies one product parameter into the media entries it carries.
 *
 * Returns an entry per URL in the value, so a parameter holding several
 * files (see MULTI_VALUE_SEPARATOR) yields several, and one holding a
 * single URL yields exactly one. Returns an empty array when the parameter
 * isn't media at all — its name isn't in `parameters`, or no piece of its
 * value is URL-shaped — which is also what makes "no video configured"
 * render as nothing rather than an empty player.
 *
 * Pieces are validated individually, so a value that's part URLs and part
 * prose contributes the URLs it does have instead of being discarded
 * whole.
 *
 * @param parameters - The tenant's resolved identifier→kind table (defaults
 *   merged with that tenant's own overrides). Falls back to
 *   PRODUCT_MEDIA_PARAMETER_DEFAULTS when omitted, for callers that don't
 *   have tenant context (e.g. standalone tests).
 */
function normalizeParameterTable(
  parameters: Record<string, ProductMediaKind>,
): Record<string, ProductMediaKind> {
  const normalized: Record<string, ProductMediaKind> = {};
  for (const [name, kind] of Object.entries(parameters)) {
    normalized[name.trim().toLowerCase()] = kind;
  }
  return normalized;
}

export function classifyMediaParameter(
  param: {
    identifier?: string;
    name?: string;
    label?: string;
    value?: string;
  },
  parameters: Record<
    string,
    ProductMediaKind
  > = PRODUCT_MEDIA_PARAMETER_DEFAULTS,
): ProductMediaParameter[] {
  // `identifier` is the parameter's language-invariant key — Geins documents
  // it as the same across every language and stable when the display name
  // changes. `name` is the display string, so keying on it would classify
  // correctly in the default locale and silently stop on every other one,
  // dumping a raw URL into the spec table instead. Falls back to `name` only
  // because the field is nullable in the schema.
  const key = (param.identifier || param.name)?.trim().toLowerCase();
  if (!key) return [];

  // The table is merchant-supplied, so its keys arrive in whatever case the
  // admin typed. Normalizing the whole table rather than probing it for a
  // match is what makes an override actually override: `{"Manual": "video"}`
  // spread over the defaults is a second key beside `manual`, and a direct
  // lookup would find the default first and return 'document' forever.
  // Collapsing to lowercase lets the later entry win, as a spread implies.
  const kind = normalizeParameterTable(parameters)[key];
  if (!kind || !param.value) return [];

  const label = formatParameterLabel(param.label || param.name || '');

  return param.value
    .split(MULTI_VALUE_SEPARATOR)
    .map((piece) => piece.trim())
    .filter(isUrlValue)
    .map((url) => {
      const embedUrl = kind === 'video' ? resolveVideoEmbedUrl(url) : null;
      return {
        kind,
        label,
        url,
        embedUrl,
        display: resolveDisplay(kind, url, embedUrl),
        fileType: resolveFileType(url),
        fileName: resolveFileName(url),
      };
    });
}

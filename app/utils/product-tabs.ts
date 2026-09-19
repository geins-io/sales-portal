import type { DetailProduct, ParameterGroupType } from '#shared/types/commerce';
import { adminText } from '~/utils/product-texts';
import {
  classifyMediaParameter,
  PRODUCT_MEDIA_PARAMETER_DEFAULTS,
  type ProductMediaKind,
  type ProductMediaParameter,
} from '#shared/constants/product-media';
import { formatLength, formatWeight } from '~/utils/measurements';

/**
 * What the product tab row is made of, as data.
 *
 * In a `.ts` rather than in the components for the reason the configurator
 * keeps its rules out of templates: Stryker instruments a file before the Vue
 * compiler runs, so a condition written in a template is one nothing proves.
 * Both the ordinary product page and the configurator page read the row from
 * here, so the two rows cannot drift apart.
 */

/** The anchor the configurator page's primary call to action scrolls to. */
export const CONFIGURATION_TAB_ID = 'product-configuration';

/** The tab values, in the order they are rendered. */
export type ProductTabValue =
  | 'configuration'
  | 'description'
  | 'specifications'
  | 'documents'
  | 'related';

export interface ProductTabContent {
  hasDescription: boolean;
  hasSpecs: boolean;
  hasDocuments: boolean;
  hasRelated: boolean;
}

/**
 * True when the HTML carries visible copy, not just empty editor markup
 * (e.g. `<p><br></p>`), so a blank field never shows an empty block.
 */
export function hasRenderableHtml(html: string | undefined): html is string {
  return !!html && html.replace(/<[^>]*>/g, '').trim().length > 0;
}

/**
 * The description tab shows the merchant's admin "Text 2" copy first, then
 * "Text 3". `adminText` maps the PIM box numbers onto the offset Merchant API
 * fields (see ~/utils/product-texts).
 */
export function productDescriptionTexts(product: DetailProduct): {
  text2?: string;
  text3?: string;
} {
  const text2 = adminText(product.texts, 2);
  const text3 = adminText(product.texts, 3);
  return {
    text2: hasRenderableHtml(text2) ? text2 : undefined,
    text3: hasRenderableHtml(text3) ? text3 : undefined,
  };
}

const HIDDEN_PARAMETER_GROUPS = /^monitor$/i;

/** Groups the catalogue marks internal, before anything reads them. */
function shownGroups(
  groups: ParameterGroupType[] | undefined,
): ParameterGroupType[] {
  return (groups ?? []).filter(
    (g) => !HIDDEN_PARAMETER_GROUPS.test(g.name ?? ''),
  );
}

/**
 * Groups the buyer may see, each stripped of parameters with nothing to show
 * and of any parameter already rendered as media in the documents tab.
 *
 * `mediaKeys` comes from classifyProductMedia below. Without it a media
 * parameter renders twice: once as an embed or a download link, and once as a
 * spec row holding a raw URL.
 */
export function visibleParameterGroups(
  groups: ParameterGroupType[] | undefined,
  mediaKeys: ReadonlySet<string> = new Set(),
): ParameterGroupType[] {
  return shownGroups(groups)
    .map((g) => ({
      ...g,
      parameters: (g.parameters ?? []).filter(
        (p) =>
          // `show: false` is the merchant saying this parameter is internal.
          // Only an explicit false hides it; an absent flag means visible.
          p?.show !== false &&
          (p.name || p.label) &&
          p.value != null &&
          !mediaKeys.has(mediaKey(g, p)),
      ),
    }))
    .filter((g) => g.parameters.length > 0);
}

/**
 * The tab the ordinary product page opens on: the first one with content, or
 * undefined when the product has none.
 *
 * Documents used to be the unconditional fallback, from when the tab always
 * rendered. It is conditional now, so naming it here would open the page on a
 * tab that does not exist.
 */
export function defaultProductTab(
  content: ProductTabContent,
): ProductTabValue | undefined {
  if (content.hasDescription) return 'description';
  if (content.hasSpecs) return 'specifications';
  if (content.hasDocuments) return 'documents';
  if (content.hasRelated) return 'related';
  return undefined;
}

/** True when any tab has something in it. */
export function hasAnyProductTab(content: ProductTabContent): boolean {
  return (
    content.hasDescription ||
    content.hasSpecs ||
    content.hasDocuments ||
    content.hasRelated
  );
}

/** A tab in the configurator page's row: what it is, and what it is called. */
export interface ConfiguratorTab {
  value: ProductTabValue;
  labelKey: string;
}

/**
 * The configurator page's row: the configuration first, then the ordinary
 * product's own tabs on the same conditions the ordinary page applies. The
 * configuration tab is always present — it is what the page is for.
 */
export function configuratorTabs(
  content: ProductTabContent,
): ConfiguratorTab[] {
  const tabs: ConfiguratorTab[] = [
    { value: 'configuration', labelKey: 'configurator.product_configuration' },
  ];
  if (content.hasDescription)
    tabs.push({ value: 'description', labelKey: 'product.details' });
  if (content.hasSpecs)
    tabs.push({ value: 'specifications', labelKey: 'product.specifications' });
  if (content.hasDocuments)
    tabs.push({ value: 'documents', labelKey: 'product.documents' });
  if (content.hasRelated)
    tabs.push({ value: 'related', labelKey: 'product.related' });
  return tabs;
}

/**
 * Identity of one parameter within its group, so a media parameter can be
 * excluded from the spec table without excluding a same-named parameter in a
 * different group.
 */
function mediaKey(
  group: ParameterGroupType,
  param: { identifier?: string | null; name?: string | null },
): string {
  return `${group.parameterGroupId}:${param.identifier ?? param.name ?? ''}`;
}

export interface ClassifiedProductMedia {
  videos: ProductMediaParameter[];
  documents: ProductMediaParameter[];
  /** Parameters pulled out of the spec table, keyed by mediaKey. */
  mediaKeys: Set<string>;
}

/**
 * Splits a product's parameters into media and everything else.
 *
 * Runs over the shown groups, not every group: media lives on parameters like
 * any other value, so classifying the unfiltered list would publish an
 * internal group's documents in the documents tab while its spec rows stayed
 * correctly hidden.
 */
export function classifyProductMedia(
  product: DetailProduct,
  parameters: Record<
    string,
    ProductMediaKind
  > = PRODUCT_MEDIA_PARAMETER_DEFAULTS,
): ClassifiedProductMedia {
  const videos: ProductMediaParameter[] = [];
  const documents: ProductMediaParameter[] = [];
  const mediaKeys = new Set<string>();

  for (const group of shownGroups(product.parameterGroups)) {
    for (const param of group.parameters ?? []) {
      if (param?.show === false) continue;
      // One parameter can carry several files, so this is 0-n entries; an
      // empty result means the parameter is not media and stays in the spec
      // table.
      const media = classifyMediaParameter(param ?? {}, parameters);
      if (media.length === 0) continue;
      mediaKeys.add(mediaKey(group, param ?? {}));
      for (const entry of media) {
        (entry.kind === 'video' ? videos : documents).push(entry);
      }
    }
  }

  return { videos, documents, mediaKeys };
}

/** The synthetic group id for product-level measurements. */
export const MEASUREMENT_GROUP_ID = -1;

/**
 * Length, width, height and weight as a spec group.
 *
 * They are fields on the product record rather than parameters, and Geins
 * returns 0 for "never set" rather than null, so zero rows are dropped. A row
 * is also dropped when a visible parameter already expresses it: plenty of
 * catalogues carry weight as an ordinary parameter, and appending the
 * product-level value regardless renders "500g" from the catalogue beside
 * "500 g" from here.
 */
export function measurementGroup(
  product: DetailProduct,
  groups: ParameterGroupType[],
  label: (key: string) => string,
  locale: string,
): ParameterGroupType | null {
  const claimed = new Set<string>();
  for (const group of groups) {
    for (const param of group.parameters ?? []) {
      const key = (param?.identifier || param?.name)?.trim().toLowerCase();
      if (key) claimed.add(key);
    }
  }

  const dimensions = product.dimensions;
  const parameters = [
    { key: 'length', value: dimensions?.length, format: formatLength },
    { key: 'width', value: dimensions?.width, format: formatLength },
    { key: 'height', value: dimensions?.height, format: formatLength },
    { key: 'weight', value: product.weight, format: formatWeight },
  ].flatMap((row) =>
    typeof row.value === 'number' && row.value > 0 && !claimed.has(row.key)
      ? [
          {
            name: row.key,
            label: label(`product.${row.key}`),
            value: row.format(row.value, locale),
            show: true,
            identifier: `measurement-${row.key}`,
          },
        ]
      : [],
  );

  if (parameters.length === 0) return null;
  return {
    name: label('product.measurements'),
    parameterGroupId: MEASUREMENT_GROUP_ID,
    parameters,
  } as ParameterGroupType;
}

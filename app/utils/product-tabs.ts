import type { DetailProduct, ParameterGroupType } from '#shared/types/commerce';
import { adminText } from '~/utils/product-texts';

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

/** Groups the buyer may see, each stripped of parameters with nothing to show. */
export function visibleParameterGroups(
  groups: ParameterGroupType[] | undefined,
): ParameterGroupType[] {
  return (groups ?? [])
    .filter((g) => !HIDDEN_PARAMETER_GROUPS.test(g.name ?? ''))
    .map((g) => ({
      ...g,
      parameters: (g.parameters ?? []).filter(
        (p) => (p.name || p.label) && p.value != null,
      ),
    }))
    .filter((g) => g.parameters.length > 0);
}

/** The tab the ordinary product page opens on: the first one with content. */
export function defaultProductTab(content: ProductTabContent): ProductTabValue {
  if (content.hasDescription) return 'description';
  if (content.hasSpecs) return 'specifications';
  if (content.hasRelated) return 'related';
  return 'documents';
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
  tabs.push({ value: 'documents', labelKey: 'product.documents' });
  if (content.hasRelated)
    tabs.push({ value: 'related', labelKey: 'product.related' });
  return tabs;
}

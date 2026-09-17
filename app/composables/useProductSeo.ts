import type { DetailProduct } from '#shared/types/commerce';

/**
 * The head every product page publishes: canonical and hreflang, the meta
 * description and og tags, and the Schema.org Product + BreadcrumbList.
 *
 * One implementation for every product type, because a second one drifts: the
 * canonical is built from the URL alias rather than the product's own, which is
 * the kind of detail a copy loses. `offers` is the one part that is not
 * universal — a configured product has no single price until it is committed,
 * so the configurator page publishes the product without one.
 */
export interface ProductSeoOptions {
  product: () => DetailProduct;
  /** Locale-free page path, e.g. `/p/<alias>` built from the URL alias. */
  path: () => string;
  breadcrumbs: () => { label: string; href?: string }[];
  localeAlternates: MaybeRefOrGetter<Record<string, string>>;
  /** The sku the page has resolved, when it resolves one. */
  sku?: () => string;
  withOffers: boolean;
}

export function useProductSeo(options: ProductSeoOptions): void {
  const { product, path, breadcrumbs, localeAlternates, sku, withOffers } =
    options;

  const plainDescription = computed(
    () =>
      product()
        .texts?.text1?.replace(/<[^>]*>/g, '')
        .slice(0, 160) ?? '',
  );

  const primaryImageUrl = computed(
    () =>
      product().productImages?.find((i) => i.isPrimary)?.url ??
      product().productImages?.[0]?.url ??
      '',
  );

  const { seoLinks } = useSeoLinks(path, localeAlternates);

  useHead({
    title: () => product().name ?? '',
  });

  useSeoMeta({
    description: () => plainDescription.value,
    ogTitle: () => product().name ?? '',
    ogDescription: () => plainDescription.value,
    ogImage: () => primaryImageUrl.value || undefined,
    ogUrl: () => seoLinks.value.find((l) => l.rel === 'canonical')?.href ?? '',
  });

  useSchemaOrg([
    defineProduct({
      name: () => product().name ?? '',
      description: () => plainDescription.value,
      image: () =>
        product()
          .productImages?.map((img) => img.url)
          .filter(Boolean) ?? [],
      brand: () =>
        product().brand?.name
          ? { '@type': 'Brand', name: product().brand!.name }
          : undefined,
      sku: () => sku?.() ?? '',
      offers: () =>
        withOffers && product().unitPrice
          ? {
              '@type': 'Offer' as const,
              price: product().unitPrice!.sellingPriceIncVat ?? 0,
              priceCurrency: product().unitPrice!.currency?.code ?? 'SEK',
              availability: product().totalStock?.inStock
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
              itemCondition: 'https://schema.org/NewCondition',
            }
          : undefined,
      aggregateRating: () =>
        product().rating?.reviewCount
          ? {
              '@type': 'AggregateRating' as const,
              ratingValue: product().rating?.averageRating ?? 0,
              reviewCount: product().rating!.reviewCount,
            }
          : undefined,
    }),
    defineBreadcrumb({
      itemListElement: () =>
        breadcrumbs().map((bc, i) => ({
          '@type': 'ListItem' as const,
          position: i + 1,
          name: bc.label,
          item: bc.href,
        })),
    }),
  ]);
}

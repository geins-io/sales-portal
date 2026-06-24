<script setup lang="ts">
import type { DetailProduct, ListProduct } from '#shared/types/commerce';
import { filterVisibleCampaigns, getStockStatus } from '#shared/types/commerce';
import type { ContentAreaType } from '#shared/types/cms';
import { CMS_SLOTS } from '#shared/types/cms-slots';
import { BADGE_DESTRUCTIVE } from '~/lib/badge-styles';
import {
  AlertTriangle as AlertTriangleIcon,
  BadgeCheck,
  Download,
  ListPlus,
  ShoppingCart,
  Star,
} from 'lucide-vue-next';
import { useCartStore } from '~/stores/cart';
import { useFavoritesStore } from '~/stores/favorites';
import { useAuthStore } from '~/stores/auth';
import {
  productPath as buildProductPath,
  categoryPath,
} from '#shared/utils/route-helpers';
import { recoverEntityUrl } from '~/composables/useEntityUrlRecovery';

const props = defineProps<{
  alias: string;
}>();

const slug = computed(() => props.alias);

const { localeQuery, localePath } = useLocaleMarket();
// Visibility flags gate the price/stock blocks in the top area. PriceDisplay
// and StockBadge render an empty root when hidden, so without these the empty
// containers still take gap-6 spacing and leave a gap above the variant
// selector. Gating here keeps those blocks out of the layout entirely.
const { showPrice } = usePriceVisibility();
const { showStock } = useStockVisibility();

const {
  data: product,
  error,
  status,
} = await useFetch<DetailProduct>(() => `/api/products/${slug.value}`, {
  query: localeQuery,
  dedupe: 'defer',
});

// On a content miss (missing product or fetch error) the old slug may be a
// renamed/old product that should 301 to its canonical instead of 404ing
// (Problem B). recoverEntityUrl consults the resolver, 301s to the canonical
// (or a urlHistory redirect), and throws a fatal 404 only on a terminal miss.
// Kept in the setup await position so the redirect/404 carries a real SSR
// status before render. Without this, crawlers would index phantom URLs.
if (error.value || !product.value?.productId) {
  await recoverEntityUrl(useRoute().path);
}

const isLoading = computed(() => status.value === 'pending');

// When the loaded product's canonicalUrl differs from the URL the user is
// on, issue a real 301 to the canonical. Geins returns prefix-less
// canonicals (e.g. /se/sv/material/grenror/grenror-150-150-88) that 404 on
// refresh, so we normalize the canonical to the ROUTABLE /p/ form via the
// route helper rather than redirecting to the raw value. navigateTo is
// SSR-safe and crawler-grade (a single clean render at the final URL with no
// hydration risk), so this replaces the former client-only
// history.replaceState. Only fires when the canonical stays in the same
// /market/locale/ prefix; a fallback that crossed locales (server served
// default-language content on a missing-translation request) must not yank the
// user back out of the locale they asked for, so samePrefix is checked on the
// RAW canonical before normalizing. No-op when the routable target equals the
// current path (loop guard).
{
  const canonical = product.value?.canonicalUrl;
  const path = useRoute().path;
  if (
    canonical &&
    typeof canonical === 'string' &&
    samePrefix(canonical, path)
  ) {
    const routable = localePath(buildProductPath(canonical));
    if (routable !== path) {
      await navigateTo(routable, { redirectCode: 301, replace: true });
    }
  }
}

// Returns true when both paths share the same /market/locale/ prefix, or
// when either is too short to have one. Used to suppress the canonical 301
// when a locale fallback returned a canonicalUrl in a different locale.
function samePrefix(a: string, b: string): boolean {
  const aSeg = a.split('/').slice(1, 3);
  const bSeg = b.split('/').slice(1, 3);
  if (aSeg.length < 2 || bSeg.length < 2) return true;
  return aSeg[0] === bSeg[0] && aSeg[1] === bSeg[1];
}

const { data: related } = useFetch<ListProduct[]>(
  () => `/api/products/${slug.value}/related`,
  {
    query: localeQuery,
    dedupe: 'defer',
    lazy: true,
  },
);

// Variant state
const selectedVariants = ref<Record<string, string>>({});

// Seed the selector with the product's own active variant so the trigger
// shows the current variant name and the matching row is highlighted in
// the sheet, instead of the empty "Select" placeholder. Sibling-variant
// products expose each variant as its own product alias; the variant the
// user is currently viewing is the one whose alias matches this product's
// alias. Seeding the current alias's own value is a no-op for the
// navigation watch below (its `picked.alias === product.alias` guard
// returns early), so this never triggers a redirect.
function currentVariantSelection(
  p: DetailProduct | null | undefined,
): Record<string, string> | null {
  const variants = p?.variantGroup?.variants ?? [];
  const current = variants.find(
    (v) => (v as { alias?: string | null }).alias === p?.alias,
  );
  if (!current) return null;
  const dimension = (current as { dimension?: string | null }).dimension;
  const value =
    (current as { value?: string | null }).value ??
    (current as { label?: string | null }).label;
  if (!dimension || value == null) return null;
  return { [dimension]: value };
}

watch(
  product,
  (p) => {
    const seeded = currentVariantSelection(p);
    if (seeded) selectedVariants.value = seeded;
  },
  { immediate: true },
);

// Publish this product's per-locale alternate URLs so the language switcher
// can land on the target-language slug instead of the current one. Immediate
// so the alternate is ready on first SSR/CSR load (a hard refresh must have it
// before the user opens the switcher); null clears so a 404/empty page never
// retains a previous product's alternates.
const { setAlternates, alternates: localeAlternates } = useLocaleAlternates();
watch(product, (p) => setAlternates(p?.alternativeUrls, { type: 'product' }), {
  immediate: true,
});

const resolvedSku = computed(() => {
  if (!product.value?.variantGroup?.variants?.length) {
    return product.value?.skus?.[0] ?? null;
  }
  const variant = product.value.variantGroup.variants.find((v) =>
    v.attributes?.every(
      (attr) =>
        selectedVariants.value[attr.attributeName] === attr.attributeValue,
    ),
  );
  if (!variant) return product.value.skus?.[0] ?? null;
  return product.value.skus?.find((s) => s.skuId === variant.variantId) ?? null;
});

const quantity = ref(1);

const cartStore = useCartStore();
const favoritesStore = useFavoritesStore();
const authStore = useAuthStore();
const { hasFeature, isCatalogMode } = useTenant();
const { buildProductImageAlt } = useProductImageAlt();
const { canAccess } = useFeatureAccess();
const canPurchase = computed(
  () => canAccess('orderPlacement') && !isCatalogMode.value,
);
const isOutOfStock = computed(() => {
  const stock = product.value?.totalStock;
  if (!stock) return false;
  return getStockStatus(stock) === 'out-of-stock';
});
const cartQtyForSelectedSku = computed(() => {
  const skuId = resolvedSku.value?.skuId;
  if (!skuId) return 0;
  const items = cartStore.cart?.items ?? [];
  return items
    .filter((i) => String(i.skuId) === String(skuId))
    .reduce((sum, i) => sum + (i.quantity ?? 0), 0);
});
// Effective remaining = totalStock minus the quantity of this SKU already
// in the cart. Used to cap the quantity stepper and disable add-to-cart so
// the user cannot push the cart past the available stock. Oversellable and
// static (on-demand) products are not stock-limited.
const stockThreshold = computed(() => {
  const stock = product.value?.totalStock;
  if (!stock) return Number.POSITIVE_INFINITY;
  if (stock.oversellable > 0 || stock.static > 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, (stock.totalStock ?? 0) - cartQtyForSelectedSku.value);
});
const maxQuantity = computed(() => {
  const threshold = stockThreshold.value;
  if (!Number.isFinite(threshold)) return 99;
  return Math.max(1, threshold);
});
const cartIsFull = computed(
  () => Number.isFinite(stockThreshold.value) && stockThreshold.value === 0,
);

const isFavorited = computed(() =>
  product.value ? favoritesStore.isFavorite(product.value.alias) : false,
);

const showListPicker = ref(false);

function openListPicker() {
  if (!product.value) return;
  showListPicker.value = true;
}

function toggleFavourite() {
  if (!product.value) return;
  favoritesStore.toggle(product.value.alias);
}

function printDataSheet() {
  if (import.meta.client) window.print();
}

// Plain-text variants of CMS-authored copy. Text 1 lands under the price
// and Text 3 under the product details block; both fields may contain
// editor HTML, but the top-area inlines render as small body copy and
// the markup would otherwise leak as visible angle brackets.
function stripHtml(value: string | null | undefined): string {
  return value ? value.replace(/<[^>]*>/g, '').trim() : '';
}

const text3Plain = computed(() => stripHtml(product.value?.texts?.text3));

// Full canonical URL used on the print header row 2 and as the source
// for the alias path in the additional-images grid caption.
const printUrl = computed(() => {
  const url = useRequestURL();
  return `${url.origin}${url.pathname}`;
});

// Additional images beyond the primary, rendered only on print under
// the "Ytterligare bilder" heading. The primary image is dropped from
// the list — it's already in the gallery on the top area card. Geins
// returns ProductImage with `fileName` (the CDN slug); GeinsImage
// builds the actual URL at render time.
const additionalImages = computed(() => {
  const images = product.value?.productImages ?? [];
  if (images.length <= 1) return [];
  const primary = images.find((i) => i.isPrimary) ?? images[0];
  return images.filter((i) => i.fileName && i !== primary);
});

// Last-ordered summary for this product. Auth-gated, lazy — skips
// the fetch entirely for anonymous visitors (the common case).
const { latestOrder, formattedDate: latestOrderDate } =
  useLatestOrderForAlias(slug);

// The variant selector renders for two distinct shapes Geins returns.
// Internal multi-SKU products surface their variants in `product.skus`
// (length > 1). Sibling-variant products are wrapped in a
// `variantGroup` so each variant value is a separate product alias;
// the current product's `skus` stays at 1 but `variantGroup.variants`
// carries the siblings.
const showVariantSelector = computed(() => {
  const dims = product.value?.variantDimensions ?? [];
  if (!dims.length) return false;
  const skuCount = product.value?.skus?.length ?? 0;
  const siblingCount = product.value?.variantGroup?.variants?.length ?? 0;
  return skuCount > 1 || siblingCount > 1;
});

// Sibling-variant products. Geins's VariantType payload omits each variant's
// price and articleNumber, and its `label` carries a "<dimension> <value> / "
// prefix rather than the clean product name, so without resolving the real
// products the sheet mirrors the parent product on every row. Each variant
// DOES carry its own productId, so all siblings' name + art-nr + price are
// resolved in ONE `products(filter: { productIds })` call. Products with many
// variants (80+ siblings exist) overflowed the per-alias fan-out endpoint's
// size cap and resolved to nothing; a single id-filtered query (up to Geins's
// 600 cap, no nested variantGroup payload) is both correct and scalable.
const siblingProductIds = computed<number[]>(() => {
  const variants = product.value?.variantGroup?.variants ?? [];
  const currentId = product.value?.productId;
  const ids = variants
    .map((v) => (v as { productId?: number | null }).productId)
    .filter((id): id is number => typeof id === 'number' && id > 0)
    .filter((id) => id !== currentId);
  return [...new Set(ids)];
});

// Slim shape returned by /api/products/by-ids (products-by-ids.graphql): only
// the fields the sheet renders, keyed back to each variant by alias.
interface VariantMetaProduct {
  productId: number;
  alias?: string | null;
  name?: string | null;
  articleNumber?: string | null;
  unitPrice?: { sellingPriceIncVatFormatted?: string | null } | null;
}

const { data: siblingProducts, execute: fetchSiblings } = useFetch<{
  products: VariantMetaProduct[];
}>('/api/products/by-ids', {
  query: computed(() => ({
    ids: siblingProductIds.value.join(','),
    ...localeQuery.value,
  })),
  immediate: false,
  dedupe: 'defer',
  lazy: true,
});
watch(
  siblingProductIds,
  (ids) => {
    if (ids.length) fetchSiblings();
  },
  { immediate: true },
);

const variantProductsByAlias = computed<
  Record<
    string,
    {
      priceFormatted?: string | null;
      articleNumber?: string | null;
      name?: string | null;
    }
  >
>(() => {
  const map: Record<
    string,
    {
      priceFormatted?: string | null;
      articleNumber?: string | null;
      name?: string | null;
    }
  > = {};
  for (const p of siblingProducts.value?.products ?? []) {
    if (!p?.alias) continue;
    map[p.alias] = {
      priceFormatted: p.unitPrice?.sellingPriceIncVatFormatted ?? null,
      articleNumber: p.articleNumber ?? null,
      name: p.name ?? null,
    };
  }
  return map;
});

// --- CMS zone on PDP (tenant-configurable via CMS_SLOTS.PRODUCT_DETAIL) ---
// Rendered below the related-products row when the slot is configured
// and the area has content. Missing slot or empty area simply omits
// the zone — product info is the primary content.
const { currentLocale, currentMarket } = useLocaleMarket();
const pdpSlot = useCmsSlot(CMS_SLOTS.PRODUCT_DETAIL);

const { data: pdpCmsArea } = useFetch<ContentAreaType>('/api/cms/area', {
  query: computed(() =>
    pdpSlot.value
      ? {
          family: pdpSlot.value.family,
          areaName: pdpSlot.value.areaName,
          ...(currentLocale.value ? { locale: currentLocale.value } : {}),
          ...(currentMarket.value ? { market: currentMarket.value } : {}),
        }
      : { skip: '1' },
  ),
  immediate: !!pdpSlot.value,
  dedupe: 'defer',
  lazy: true,
});

async function addToCart() {
  if (!resolvedSku.value?.skuId) return;
  await cartStore.addItem(resolvedSku.value.skuId, quantity.value);
}

// Sibling-variant products list each variant as its own product alias
// in variantGroup.variants. When the user picks a different variant in
// the selector, navigate to that variant's PDP rather than mutating
// state in place. Keeps the path prefix segments (e.g. /material/grenror)
// and swaps the last segment for the picked variant's alias.
const route = useRoute();
watch(
  selectedVariants,
  async (sel) => {
    const variants = product.value?.variantGroup?.variants ?? [];
    if (!variants.length || !product.value?.alias) return;
    const picked = variants.find((v) => {
      const dim = (v as { dimension?: string }).dimension;
      const val = (v as { value?: string | null }).value;
      if (dim && val != null) return sel[dim] === val;
      const attrs = Array.isArray(v.attributes) ? v.attributes : [];
      return attrs.every((attr) => {
        const k =
          (attr as { attributeName?: string; key?: string }).attributeName ??
          (attr as { key?: string }).key;
        const a =
          (attr as { attributeValue?: string; value?: string })
            .attributeValue ?? (attr as { value?: string }).value;
        return k ? sel[k] === a : true;
      });
    }) as { alias?: string } | undefined;
    if (!picked?.alias || picked.alias === product.value.alias) return;
    const raw = route.params.alias;
    const segs = Array.isArray(raw) ? [...raw] : raw ? [raw as string] : [];
    if (segs.length) segs[segs.length - 1] = picked.alias;
    else segs.push(picked.alias);
    await navigateTo(localePath(buildProductPath(`/${segs.join('/')}`)));
  },
  { deep: true },
);

// Discount campaigns
const visibleCampaigns = computed(() =>
  filterVisibleCampaigns(product.value?.discountCampaigns ?? []),
);

// Breadcrumbs
const { t } = useI18n();

const breadcrumbItems = computed(() => {
  const items: { label: string; href?: string }[] = [
    { label: t('common.home'), href: localePath('/') },
  ];

  // Extract category from the product's primaryCategory if available
  const category = product.value?.primaryCategory;
  if (category?.name) {
    const catAlias = category.alias || category.name.toLowerCase();
    items.push({
      label: category.name,
      href: localePath(categoryPath(`/${catAlias}`)),
    });
  }

  if (product.value?.name) {
    items.push({ label: product.value.name });
  }

  return items;
});

// SEO
const plainDescription = computed(
  () =>
    product.value?.texts?.text1?.replace(/<[^>]*>/g, '').slice(0, 160) ?? '',
);

const primaryImageUrl = computed(
  () =>
    product.value?.productImages?.find((i) => i.isPrimary)?.url ??
    product.value?.productImages?.[0]?.url ??
    '',
);

const productPath = computed(() => `/p/${slug.value}`);
// localeAlternates holds the real per-locale slugs published by setAlternates
// above (populated with immediate:true so the watch fires before this line).
// It is useState-backed (SSR-safe, no window) and reactive so hreflang stays
// correct after client-side navigation without any hydration mismatch.
const { seoLinks } = useSeoLinks(productPath, localeAlternates);

useHead({
  title: () => product.value?.name ?? '',
});

useSeoMeta({
  description: () => plainDescription.value,
  ogTitle: () => product.value?.name ?? '',
  ogDescription: () => plainDescription.value,
  ogImage: () => primaryImageUrl.value || undefined,
  ogUrl: () => seoLinks.value.find((l) => l.rel === 'canonical')?.href ?? '',
});

// JSON-LD structured data (Schema.org Product + BreadcrumbList)
useSchemaOrg([
  defineProduct({
    name: () => product.value?.name ?? '',
    description: () => plainDescription.value,
    image: () =>
      product.value?.productImages?.map((img) => img.url).filter(Boolean) ?? [],
    brand: () =>
      product.value?.brand?.name
        ? { '@type': 'Brand', name: product.value.brand.name }
        : undefined,
    sku: () => resolvedSku.value?.skuId?.toString() ?? '',
    offers: () =>
      product.value?.unitPrice
        ? {
            '@type': 'Offer' as const,
            price: product.value.unitPrice.sellingPriceIncVat ?? 0,
            priceCurrency: product.value.unitPrice.currency?.code ?? 'SEK',
            availability: product.value.totalStock?.inStock
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            itemCondition: 'https://schema.org/NewCondition',
          }
        : undefined,
    aggregateRating: () =>
      product.value?.rating?.reviewCount
        ? {
            '@type': 'AggregateRating' as const,
            ratingValue: product.value.rating.averageRating ?? 0,
            reviewCount: product.value.rating.reviewCount,
          }
        : undefined,
  }),
  defineBreadcrumb({
    itemListElement: () =>
      breadcrumbItems.value.map((bc, i) => ({
        '@type': 'ListItem' as const,
        position: i + 1,
        name: bc.label,
        item: bc.href,
      })),
  }),
]);
</script>

<template>
  <!-- Loading skeleton -->
  <ProductDetailsSkeleton
    v-if="isLoading && !product"
    data-testid="pdp-loading"
  />

  <!-- Error state -->
  <EmptyState
    v-else-if="error"
    :icon="AlertTriangleIcon"
    :title="$t('product.failed_to_load')"
    :description="$t('common.something_went_wrong')"
    action-label="Home"
    :action-to="localePath('/')"
    data-testid="pdp-error"
  />

  <div v-else-if="product" class="px-4 py-8 lg:px-6">
    <div class="mx-auto max-w-7xl space-y-8">
      <!-- Print-only header: store logo + timestamp + product URL.
         Hidden on screen, shown via @media print. -->
      <PrintHeader :product-url="printUrl" />

      <!-- Breadcrumbs -->
      <AppBreadcrumbs v-if="breadcrumbItems.length" :items="breadcrumbItems" />

      <!-- PDP top area: 3-column layout per Figma
         lg+: gallery (max 400) | main info | right card
         md:  gallery + info on first row, right card below
         mobile: stacked single column -->
      <div
        class="bg-card grid gap-6 rounded-lg border p-4 md:p-6 lg:grid-cols-[400px_1fr_265px] lg:gap-10"
        data-testid="pdp-top-area"
      >
        <!-- Left: Gallery -->
        <ErrorBoundary section="product-gallery">
          <ProductGallery
            v-if="product.productImages?.length"
            :images="product.productImages"
            :product-name="product.name ?? ''"
            class="w-full max-w-[400px]"
          />
        </ErrorBoundary>

        <!-- Middle: Product info -->
        <div class="flex flex-col gap-6">
          <!-- Product name + meta -->
          <div class="flex flex-col gap-1">
            <h1
              class="font-heading my-[15px] text-3xl leading-tight font-bold"
              data-testid="product-name"
            >
              {{ product.name }}
            </h1>

            <!-- Article number -->
            <p
              v-if="product.articleNumber"
              class="text-muted-foreground text-[20px]"
              data-testid="product-article-number"
            >
              Art nr. {{ product.articleNumber }}
            </p>

            <!-- Brand -->
            <p
              v-if="product.brand?.name"
              class="text-muted-foreground"
              data-testid="product-brand"
            >
              {{ product.brand.name }}
            </p>
          </div>

          <!-- Price: sits above the long-form description so the dominant
             commerce signal anchors the column. -->
          <PriceDisplay
            v-if="product.unitPrice && showPrice"
            :price="product.unitPrice"
            :lowest-price="product.lowestPrice"
            :discount-type="product.discountType"
            :campaign-names="visibleCampaigns.map((c) => c.name)"
            class="text-2xl font-bold"
          />

          <!-- Text 3: extra detail copy under the price -->
          <p
            v-if="text3Plain"
            class="text-muted-foreground text-sm leading-relaxed"
            data-testid="product-text3"
          >
            {{ text3Plain }}
          </p>

          <!-- Campaign badges -->
          <div
            v-if="visibleCampaigns.length"
            class="flex flex-wrap gap-1"
            data-testid="pdp-campaign-badges"
          >
            <span
              v-for="campaign in visibleCampaigns"
              :key="campaign.name"
              :class="BADGE_DESTRUCTIVE"
            >
              {{ campaign.name }}
            </span>
          </div>

          <!-- Negotiated price info banner -->
          <div
            v-if="product.discountType === 'EXTERNAL'"
            class="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800"
            data-testid="negotiated-price-banner"
          >
            <BadgeCheck class="size-4 shrink-0" />
            <span>{{ $t('discount.negotiated_price_info') }}</span>
          </div>

          <!-- Stock -->
          <div v-if="product.totalStock && showStock" data-testid="stock-badge">
            <StockBadge :stock="product.totalStock" />
          </div>

          <!-- Variant selector — pass product-level data through so each
             sheet row can render a real Figma-style item with thumbnail,
             art-nr, stock and price (price is product-level so it's the
             same on every row). -->
          <VariantSelector
            v-if="showVariantSelector"
            v-model="selectedVariants"
            :variant-dimensions="product.variantDimensions ?? []"
            :variants="product.variantGroup?.variants ?? []"
            :skus="product.skus ?? []"
            :product-images="product.productImages ?? []"
            :product-name="product.name ?? ''"
            :price-formatted="
              product.unitPrice?.sellingPriceIncVatFormatted ?? null
            "
            :product-article-number="product.articleNumber ?? null"
            :variant-products="variantProductsByAlias"
          />
        </div>

        <!-- Right: actions + info card -->
        <aside class="flex flex-col gap-4">
          <!-- Quantity + Add to cart + Wishlist -->
          <template v-if="canPurchase">
            <OutOfStockBlock v-if="isOutOfStock" />
            <div
              v-else
              class="flex items-center gap-2"
              data-testid="pdp-actions"
            >
              <QuantityInput
                v-model="quantity"
                :min="1"
                :max="maxQuantity"
                :disabled="cartIsFull"
                class="h-9 shrink-0"
              />
              <Button
                variant="purchase"
                data-testid="add-to-cart-button"
                class="h-9 flex-1 gap-2 px-4"
                :disabled="cartIsFull"
                @click="addToCart"
              >
                <ShoppingCart class="size-4" />
                {{
                  cartIsFull
                    ? $t('product.max_in_cart')
                    : $t('product.add_to_cart')
                }}
              </Button>
            </div>
          </template>

          <div
            class="border-border flex flex-col border-y"
            data-testid="pdp-info-card"
          >
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground flex items-center gap-2 py-2.5 text-left text-[13px] transition-colors"
              data-testid="pdp-print"
              @click="printDataSheet"
            >
              <Download class="size-4" />
              <span>{{ $t('product.download_data_sheet') }}</span>
            </button>
            <button
              v-if="hasFeature('wishlist') && authStore.isAuthenticated"
              type="button"
              class="text-muted-foreground hover:text-foreground flex items-center gap-2 py-2.5 text-left text-[13px] transition-colors"
              data-testid="pdp-save-favourite"
              @click="toggleFavourite"
            >
              <Star class="size-4" />
              <span>
                {{
                  isFavorited
                    ? $t('product.saved_as_favourite')
                    : $t('product.save_as_favourite')
                }}
              </span>
            </button>
            <button
              v-if="authStore.isAuthenticated"
              type="button"
              class="text-muted-foreground hover:text-foreground flex items-center gap-2 py-2.5 text-left text-[13px] transition-colors"
              data-testid="pdp-add-to-lists"
              @click="openListPicker"
            >
              <ListPlus class="size-4" />
              <span>{{ $t('product.add_to_lists') }}</span>
            </button>
            <NuxtLink
              v-if="latestOrder"
              :to="
                latestOrder.latestOrderPublicId
                  ? localePath(
                      `/portal/orders/${latestOrder.latestOrderPublicId}`,
                    )
                  : localePath('/portal/orders')
              "
              class="text-muted-foreground hover:text-foreground border-border flex items-center gap-2 border-t py-2.5 text-left text-[13px] transition-colors"
              data-testid="pdp-latest-ordered"
            >
              <ShoppingCart class="size-4" />
              <span>
                {{ $t('product.latest_ordered') }}: {{ latestOrderDate }}
                <template v-if="latestOrder.latestOrderId">
                  ({{ latestOrder.latestOrderId }})
                </template>
              </span>
            </NuxtLink>
          </div>
        </aside>
      </div>

      <!-- Product tabs (full width) -->
      <ErrorBoundary section="product-tabs">
        <ProductTabs :product="product" :related="related" />
      </ErrorBoundary>

      <!-- Print-only: extra product images in a 3-col grid, gated on the
         product having more than one image so the section disappears
         cleanly when there is nothing to show. -->
      <section
        v-if="additionalImages.length"
        class="hidden"
        data-testid="pdp-print-extra-images"
      >
        <h3 class="font-heading mb-3 text-xl font-semibold">
          {{ $t('product.print_extra_images') }}
        </h3>
        <div class="grid grid-cols-3 gap-3">
          <GeinsImage
            v-for="(img, index) in additionalImages"
            :key="img.fileName ?? ''"
            :file-name="img.fileName ?? ''"
            :alt="
              buildProductImageAlt({
                name: product.name ?? '',
                index,
                total: additionalImages.length,
                manualAlt: img.altText,
              })
            "
            type="product"
            loading="eager"
            fit="contain"
            aspect-ratio="1/1"
          />
        </div>
      </section>

      <!-- CMS zone on PDP (tenant-configurable via CMS_SLOTS.PRODUCT_DETAIL).
         Omitted when unconfigured or empty. -->
      <CmsWidgetArea
        v-if="pdpCmsArea?.containers?.length"
        data-testid="pdp-cms-area"
        :containers="pdpCmsArea.containers"
      />

      <AddToListDialog
        v-if="product"
        v-model:open="showListPicker"
        :product-alias="product.alias"
      />
    </div>
  </div>
</template>
